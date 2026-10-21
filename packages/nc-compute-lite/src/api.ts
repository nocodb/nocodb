import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config.ts';
import { DockerError, docker } from './docker.ts';
import { BadRequest, Capacity, Conflict, NotFound, sandboxes, type Sandbox } from './sandboxes.ts';

/** The code server images run (E2B code-interpreter's), and what the code route proxies to. */
const CODE_PORT = 49999;
const MAX_FILE_BYTES = 64 * 1024 * 1024;

class Unavailable extends Error {}

const view = (s: Sandbox) => ({
  id: s.id,
  state: s.state,
  image: s.image,
  workload: s.workload,
  metadata: s.metadata,
  trafficToken: s.trafficToken,
  cpuCount: s.cpuCount,
  memoryMB: s.memoryMB,
  createdAt: s.createdAt,
  expiresAt: s.state === 'running' ? new Date(s.deadline).toISOString() : undefined,
});

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const sign = (id: string, path: string, exp: number) =>
  createHmac('sha256', config.apiKey).update(`${id}\n${path}\n${exp}`).digest('base64url');

async function body(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new BadRequest(`body larger than ${limit} bytes`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function jsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await body(req, 1024 * 1024);
  if (!raw.length) return {} as T;
  try {
    return JSON.parse(raw.toString('utf8')) as T;
  } catch {
    throw new BadRequest('body is not JSON');
  }
}

function send(res: ServerResponse, status: number, payload?: unknown): void {
  if (payload === undefined) {
    res.writeHead(status).end();
    return;
  }
  const text = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) }).end(text);
}

function fail(res: ServerResponse, e: unknown): void {
  const [status, error] =
    e instanceof NotFound
      ? [404, 'not_found']
      : e instanceof Conflict
        ? [409, 'conflict']
        : e instanceof Capacity
          ? [429, 'capacity']
          : e instanceof BadRequest
            ? [400, 'bad_request']
            : e instanceof Unavailable
              ? [503, 'unavailable']
            : e instanceof DockerError && e.status === 404
              ? [404, 'not_found']
              : [500, 'internal'];
  if (status === 500) console.error(JSON.stringify({ level: 'error', msg: 'request failed', error: String(e) }));
  if (!res.headersSent) send(res, status, { error, message: (e as Error)?.message ?? String(e) });
  else res.destroy();
}

/**
 * A request into the sandbox's code server, its answer streamed back. The code
 * server starts a few seconds after the sandbox, so a refused connection is
 * retried for a while: E2B's create waits for it, and callers expect that.
 */
async function proxyCode(req: IncomingMessage, res: ServerResponse, id: string, rest: string): Promise<void> {
  const payload = await body(req, 16 * 1024 * 1024);
  const address = await sandboxes.address(id);
  const deadline = Date.now() + 30_000;

  for (;;) {
    try {
      return await new Promise<void>((resolve, reject) => {
        const upstream = request(
          {
            host: address,
            port: CODE_PORT,
            method: req.method,
            path: rest || '/',
            headers: {
              'content-type': req.headers['content-type'] ?? 'application/json',
              'content-length': payload.length,
            },
          },
          (up) => {
            res.writeHead(up.statusCode ?? 502, { 'content-type': up.headers['content-type'] ?? 'application/json' });
            up.pipe(res);
            up.on('end', resolve);
            up.on('error', reject);
          },
        );
        upstream.on('error', reject);
        upstream.end(payload);
      });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (res.headersSent || (code !== 'ECONNREFUSED' && code !== 'ECONNRESET') || Date.now() > deadline) {
        if (!res.headersSent && (code === 'ECONNREFUSED' || code === 'ECONNRESET')) {
          throw new Unavailable('the sandbox has no code server running');
        }
        throw e;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://lite');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/health') {
    await docker.ping();
    return send(res, 200, {
      ok: true,
      docker: config.dockerMode,
      running: sandboxes.list({ state: ['running'] }).length,
      maxSandboxes: config.maxSandboxes,
    });
  }

  // Signed, so a browser or NocoDB fetches it without the API key.
  if (req.method === 'GET' && parts[0] === 'v1' && parts[1] === 'downloads' && parts[2]) {
    const path = url.searchParams.get('path') ?? '';
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') ?? '';
    if (!path || !(exp > Date.now() / 1000) || !same(sig, sign(parts[2], path, exp))) {
      return send(res, 403, { error: 'forbidden', message: 'bad or expired download link' });
    }
    const data = await sandboxes.readFile(parts[2], path);
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length });
    return void res.end(data);
  }

  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ') || !same(auth.slice(7), config.apiKey)) {
    return send(res, 401, { error: 'unauthorized', message: 'missing or wrong API key' });
  }

  if (parts[0] !== 'v1' || parts[1] !== 'sandboxes') return send(res, 404, { error: 'not_found', message: 'no such route' });
  const id = parts[2];
  const action = parts[3];

  if (!id) {
    if (req.method === 'POST') return send(res, 201, view(await sandboxes.create(await jsonBody(req))));
    if (req.method === 'GET') {
      const state = url.searchParams.get('state')?.split(',').filter(Boolean);
      const metadata = url.searchParams.get('metadata');
      return send(res, 200, sandboxes.list({ state, metadata: metadata ? JSON.parse(metadata) : undefined }).map(view));
    }
  } else if (!action) {
    if (req.method === 'GET') return send(res, 200, view(sandboxes.get(id)));
    if (req.method === 'DELETE') {
      await sandboxes.kill(id);
      return send(res, 204);
    }
  } else if (req.method === 'POST' && action === 'timeout') {
    const { timeoutMs } = await jsonBody<{ timeoutMs: number }>(req);
    return send(res, 200, view(await sandboxes.setTimeout(id, timeoutMs)));
  } else if (req.method === 'POST' && action === 'pause') {
    await sandboxes.pause(id);
    return send(res, 200, view(sandboxes.get(id)));
  } else if (req.method === 'POST' && action === 'resume') {
    const { timeoutMs } = await jsonBody<{ timeoutMs?: number }>(req);
    return send(res, 200, view(await sandboxes.resume(id, timeoutMs)));
  } else if (action === 'files') {
    const path = url.searchParams.get('path') ?? '';
    if (req.method === 'PUT') {
      const mode = Number.parseInt(url.searchParams.get('mode') ?? '644', 8);
      await sandboxes.writeFile(id, path, await body(req, MAX_FILE_BYTES), url.searchParams.get('user') ?? 'user', mode);
      return send(res, 204);
    }
    if (req.method === 'GET') {
      const data = await sandboxes.readFile(id, path);
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length });
      return void res.end(data);
    }
  } else if (req.method === 'POST' && action === 'download-url') {
    const { path, ttlSeconds } = await jsonBody<{ path: string; ttlSeconds?: number }>(req);
    if (!path?.startsWith('/')) throw new BadRequest('path must be absolute');
    sandboxes.get(id);
    const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds ?? 3600, 60), 7 * 86400);
    const query = new URLSearchParams({ path, exp: String(exp), sig: sign(id, path, exp) });
    return send(res, 200, { url: `/v1/downloads/${id}?${query}` });
  } else if (action === 'code') {
    return proxyCode(req, res, id, '/' + parts.slice(4).join('/') + url.search);
  }

  send(res, 404, { error: 'not_found', message: 'no such route' });
}

export function startApi(): void {
  createServer((req, res) => handle(req, res).catch((e) => fail(res, e))).listen(config.apiPort, () =>
    console.log(JSON.stringify({ level: 'info', msg: 'api listening', port: config.apiPort })),
  );
}
