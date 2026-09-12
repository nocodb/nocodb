// KEEP IN SYNC with packages/nocodb/src/ee/helpers/appLlmProxyServer.ts
// (APP_LLM_PROXY_SERVER_SOURCE — the runtime-written copy, which supersedes
// this baked file until the next image rebuild). Baked to /opt/tunnel/llm-server.js.
'use strict';
var http = require('http');
var crypto = require('crypto');
var WebSocket = require('ws');

var PORT = parseInt(process.env.LLM_PROXY_PORT || '8586', 10);
// Per-turn shared secret. The sandbox host exposes this port PUBLICLY, so
// every HTTP request and WS upgrade must present it; an empty env refuses
// everything (fail closed). Only /__health stays open — it is polled before
// any credential is negotiated and discloses nothing.
var SECRET = process.env.NC_TUNNEL_SECRET || '';

function secretMatches(value) {
  if (!SECRET || typeof value !== 'string') return false;
  var a = Buffer.from(value);
  var b = Buffer.from(SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Claude authenticates with ANTHROPIC_AUTH_TOKEN — a Bearer header the build
// processor sets to this same secret.
function httpAuthorized(req) {
  var h = req.headers['authorization'];
  if (typeof h === 'string' && h.slice(0, 7) === 'Bearer ') {
    return secretMatches(h.slice(7));
  }
  return secretMatches(req.headers['x-nc-tunnel-secret']);
}

var backendWs = null;
var pending = {};
var seq = 0;

var server = http.createServer(function (req, res) {
  if (req.url === '/__health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (!httpAuthorized(req)) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  if (!backendWs || backendWs.readyState !== WebSocket.OPEN) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'llm tunnel backend not connected' }));
    return;
  }

  var chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    var id = 'l' + (++seq);
    var bodyBuf = Buffer.concat(chunks);
    var started = false;

    pending[id] = function (msg) {
      if (msg.type === 'response-start') {
        started = true;
        res.writeHead(msg.status || 502, msg.headers || {});
        return;
      }
      if (msg.type === 'response-chunk') {
        if (!started) { started = true; res.writeHead(200); }
        res.write(Buffer.from(msg.body || msg.data || '', 'base64'));
        return;
      }
      if (msg.type === 'response-end') {
        delete pending[id];
        res.end();
        return;
      }
      if (msg.type === 'response-error') {
        delete pending[id];
        if (!started) {
          res.writeHead(msg.status || 502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: msg.message || 'llm proxy error' }));
        } else {
          res.end();
        }
        return;
      }
    };

    // If the client (claude) disconnects, tell the backend to abort upstream.
    res.on('close', function () {
      if (pending[id]) {
        delete pending[id];
        if (backendWs && backendWs.readyState === WebSocket.OPEN) {
          backendWs.send(JSON.stringify({ id: id, type: 'cancel' }));
        }
      }
    });

    backendWs.send(JSON.stringify({
      id: id,
      type: 'request',
      method: req.method,
      path: req.url,
      headers: req.headers,
      body: bodyBuf.length ? bodyBuf.toString('base64') : null
    }));
  });
});

var wss = new WebSocket.Server({
  server: server,
  path: '/__llm__',
  verifyClient: function (info) {
    return secretMatches(info.req.headers['x-nc-tunnel-secret']);
  },
});
wss.on('connection', function (ws) {
  // A reconnect only ever follows a drop, so replace a closed/closing socket —
  // but a still-OPEN backend is not mid-reconnect and must not be displaced.
  if (backendWs && backendWs.readyState === WebSocket.OPEN) {
    ws.close(1013, 'backend already connected');
    return;
  }
  backendWs = ws;
  ws.send(JSON.stringify({ type: 'connected' }));
  ws.on('message', function (data) {
    var msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }
    if (msg.id && pending[msg.id]) pending[msg.id](msg);
  });
  ws.on('close', function () {
    if (backendWs === ws) {
      var ids = Object.keys(pending);
      for (var i = 0; i < ids.length; i++) {
        var cb = pending[ids[i]];
        if (cb) cb({ type: 'response-error', status: 502, message: 'llm tunnel backend disconnected' });
      }
      backendWs = null;
    }
  });
});

function start() {
  return new Promise(function (resolve) {
    server.listen(PORT, function () {
      resolve({ server: server, port: server.address().port });
    });
  });
}

module.exports = { start: start };

if (require.main === module) {
  start().then(function (s) {
    // eslint-disable-next-line no-console
    console.error('[nocodb-app-llm-proxy] listening on ' + s.port);
  });
}
