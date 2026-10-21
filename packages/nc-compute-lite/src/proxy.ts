import { timingSafeEqual } from 'node:crypto';
import { createServer, request, type IncomingMessage } from 'node:http';
import { connect } from 'node:net';
import type { Duplex } from 'node:stream';
import { config } from './config.ts';
import { Conflict, NotFound, sandboxes } from './sandboxes.ts';

/**
 * Sandbox ports by hostname: `<port>-<sandbox id>.<any domain>` reaches that
 * port. A sandbox created with `requireAuth` answers only callers holding its
 * traffic token, under the header NocoDB already sends for E2B.
 */

const TOKEN_HEADERS = ['e2b-traffic-access-token', 'x-nc-traffic-token'];

async function target(req: IncomingMessage): Promise<{ host: string; port: number }> {
  const hostname = (req.headers.host ?? '').split(':')[0] ?? '';
  const match = /^(\d{1,5})-(nl[0-9a-f]{20})\./.exec(hostname);
  if (!match) throw Object.assign(new Error('unknown host'), { status: 404 });
  const port = Number(match[1]);
  const sandbox = sandboxes.get(match[2]!);

  if (sandbox.trafficToken) {
    const given = TOKEN_HEADERS.map((h) => req.headers[h]).find((v): v is string => typeof v === 'string') ?? '';
    const want = Buffer.from(sandbox.trafficToken);
    if (given.length !== want.length || !timingSafeEqual(Buffer.from(given), want)) {
      throw Object.assign(new Error('missing or wrong traffic token'), { status: 403 });
    }
  }

  return { host: await sandboxes.address(sandbox.id), port };
}

const statusOf = (e: unknown) =>
  (e as { status?: number }).status ?? (e instanceof NotFound ? 404 : e instanceof Conflict ? 409 : 502);

export function startProxy(): void {
  const server = createServer((req, res) => {
    target(req)
      .then(({ host, port }) => {
        const headers = { ...req.headers };
        for (const h of TOKEN_HEADERS) delete headers[h];
        const upstream = request({ host, port, method: req.method, path: req.url, headers }, (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        });
        upstream.on('error', () => {
          if (!res.headersSent) res.writeHead(502).end('sandbox port not reachable');
          else res.destroy();
        });
        req.pipe(upstream);
      })
      .catch((e) => {
        if (!res.headersSent) res.writeHead(statusOf(e), { 'content-type': 'text/plain' }).end((e as Error).message);
      });
  });

  // WebSockets: the handshake goes through as written, then bytes both ways.
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    target(req)
      .then(({ host, port }) => {
        const upstream = connect(port, host, () => {
          const lines = [`${req.method} ${req.url} HTTP/1.1`];
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            if (!TOKEN_HEADERS.includes(req.rawHeaders[i]!.toLowerCase())) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
          }
          upstream.write(lines.join('\r\n') + '\r\n\r\n');
          if (head.length) upstream.write(head);
          upstream.pipe(socket);
          socket.pipe(upstream);
        });
        upstream.on('error', () => socket.destroy());
        socket.on('error', () => upstream.destroy());
      })
      .catch((e) => {
        socket.end(`HTTP/1.1 ${statusOf(e)} ${(e as Error).message}\r\nconnection: close\r\n\r\n`);
      });
  });

  server.listen(config.proxyPort, () =>
    console.log(JSON.stringify({ level: 'info', msg: 'proxy listening', port: config.proxyPort })),
  );
}
