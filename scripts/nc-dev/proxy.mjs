#!/usr/bin/env node
/**
 * nc-dev proxy daemon
 *
 * Listens on :1355, routes {branch-slug}.noco.localhost → the correct
 * backend / frontend ports for that branch.
 *
 * Routing rules:
 *   /api/*       → backend  (bePort)
 *   /nc/*        → backend  (bePort)  — NocoDB internal paths
 *   /*           → frontend (fePort)
 *
 * WebSocket upgrades are proxied correctly for Nuxt HMR.
 *
 * Reloads registry on SIGHUP (sent by nc-dev after every start/stop/cleanup).
 */

import { createServer } from 'http';
import { request as httpRequest } from 'http';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const REGISTRY_PATH = resolve(REPO_ROOT, '.nc-dev-registry.json');
const PROXY_PORT = 1355;

// ─── Registry ─────────────────────────────────────────────────────────────────

let registry = {};

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) { registry = {}; return; }
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    registry = {};
  }
}

loadRegistry();

process.on('SIGHUP', () => {
  loadRegistry();
  console.log(`[proxy] Registry reloaded — ${Object.keys(registry).length} instance(s)`);
});

// ─── Slug → entry ─────────────────────────────────────────────────────────────

function entryForSlug(slug) {
  return Object.values(registry).find((e) => e.slug === slug) ?? null;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

// In dev mode /dashboard/ and static assets are served by the Nuxt frontend, not the backend
const BACKEND_PREFIXES = ['/api/', '/nc/'];

function isBackendRequest(pathname) {
  return BACKEND_PREFIXES.some((p) => pathname.startsWith(p));
}

function targetPort(entry, pathname) {
  return isBackendRequest(pathname) ? entry.bePort : entry.fePort;
}

// ─── HTTP proxy ───────────────────────────────────────────────────────────────

function proxyRequest(req, res, port) {
  const options = {
    hostname: 'localhost',
    port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${port}`,
    },
  };

  const proxyReq = httpRequest(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq);
}

// ─── WebSocket proxy ──────────────────────────────────────────────────────────

function proxyUpgrade(req, socket, head, port) {
  const conn = createConnection(port, 'localhost', () => {
    const headers = [
      `${req.method} ${req.url} HTTP/1.1`,
      `Host: localhost:${port}`,
      ...Object.entries(req.headers)
        .filter(([k]) => k.toLowerCase() !== 'host')
        .map(([k, v]) => `${k}: ${v}`),
      '',
      '',
    ].join('\r\n');

    conn.write(headers);
    if (head && head.length) conn.write(head);

    socket.pipe(conn);
    conn.pipe(socket);
  });

  conn.on('error', (err) => {
    socket.end();
  });

  socket.on('error', () => {
    conn.end();
  });
}

// ─── Hostname parsing ─────────────────────────────────────────────────────────

function parseSlug(host) {
  if (!host) return null;
  // Strip port
  const hostname = host.split(':')[0];
  // Match {slug}.noco.localhost
  const m = hostname.match(/^(.+)\.noco\.localhost$/);
  return m ? m[1] : null;
}

// ─── Request handler ──────────────────────────────────────────────────────────

function handle404(res, msg) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>nc-dev: not found</title></head>
    <body style="font-family:monospace;padding:2rem">
      <h2>nc-dev proxy</h2>
      <p>${msg}</p>
      <p>Run <code>node scripts/nc-dev/index.mjs list</code> to see active instances.</p>
    </body>
    </html>
  `);
}

const server = createServer((req, res) => {
  const slug = parseSlug(req.headers.host ?? '');

  if (!slug) {
    // Direct hit on localhost:1355 — show status page
    const entries = Object.values(registry);
    const rows = entries
      .map(
        (e) =>
          `<tr><td><a href="http://${e.slug}.noco.localhost:${PROXY_PORT}">${e.branch}</a></td>` +
          `<td>:${e.bePort}</td><td>:${e.fePort}</td></tr>`,
      )
      .join('');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>nc-dev</title></head>
      <body style="font-family:monospace;padding:2rem">
        <h2>nc-dev instances</h2>
        <table border="1" cellpadding="6">
          <tr><th>Branch</th><th>Backend</th><th>Frontend</th></tr>
          ${rows || '<tr><td colspan="3">No instances running</td></tr>'}
        </table>
      </body>
      </html>
    `);
    return;
  }

  const entry = entryForSlug(slug);
  if (!entry) {
    handle404(res, `No instance found for slug <strong>${slug}</strong>`);
    return;
  }

  const pathname = (req.url ?? '/').split('?')[0];
  const port = targetPort(entry, pathname);
  proxyRequest(req, res, port);
});

server.on('upgrade', (req, socket, head) => {
  const slug = parseSlug(req.headers.host ?? '');
  if (!slug) { socket.end(); return; }

  const entry = entryForSlug(slug);
  if (!entry) { socket.end(); return; }

  const pathname = (req.url ?? '/').split('?')[0];
  const port = targetPort(entry, pathname);
  proxyUpgrade(req, socket, head, port);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[proxy] Port ${PROXY_PORT} already in use — another proxy instance may be running`);
    process.exit(1);
  }
  console.error('[proxy] Server error:', err.message);
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[proxy] Listening on :${PROXY_PORT}`);
  console.log(`[proxy] Registry: ${REGISTRY_PATH}`);
  console.log(`[proxy] ${Object.keys(registry).length} instance(s) loaded`);
});
