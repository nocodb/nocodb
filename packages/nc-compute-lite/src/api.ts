import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { CODE_PORT, config } from './config.ts';
import { DockerError, docker } from './docker.ts';
import { BadRequest, Capacity, Conflict, filePath, Gone, NotFound, sandboxes, type Sandbox } from './sandboxes.ts';

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new BadRequest('body is not JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequest('body must be an object');
  return parsed as T;
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
    e instanceof Gone
      ? [404, 'gone']
      : e instanceof NotFound
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
              ? [404, 'gone'] // the container went away under its registry entry
            : e instanceof DockerError && e.status === 400
              ? [400, 'bad_request'] // the engine refused the input (a CPU count past the host's, a bad image name)
            : e instanceof DockerError && e.status === 409
              ? [409, 'conflict']
            : e instanceof DockerError && /unexpectedly nil|marked for removal|removal in progress|is not running/i.test(e.message)
              ? [409, 'conflict'] // the engine's own 500 for a container being removed or stopped meanwhile
            : (e instanceof DockerError && /connection reset|broken pipe|read response|unexpected EOF/i.test(e.message)) ||
                ['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOENT', 'ETIMEDOUT'].includes((e as NodeJS.ErrnoException)?.code ?? '')
              ? [503, 'unavailable'] // the engine's socket hiccuped (or the engine restarted): worth a retry
              : [500, 'internal'];
  // A stream cut after its headers went out (a sandbox stopped mid-run) is expected, not an error.
  if (status === 500 && !res.headersSent) {
    console.error(JSON.stringify({ level: 'error', msg: 'request failed', error: String(e) }));
  }
  if (!res.headersSent) send(res, status, { error, message: (e as Error)?.message ?? String(e) });
  else res.destroy();
}

/**
 * A request into the sandbox's code server, its answer streamed back. The code
 * server starts a few seconds after the sandbox, so a refused connection is
 * retried for a while: E2B's create waits for it, and callers expect that.
 */
async function proxyCode(req: IncomingMessage, res: ServerResponse, id: string, rest: string): Promise<void> {
  // The caller gave up: stop the run rather than leave it holding a socket.
  // Registered first and once: a caller gone during the reads below, or
  // between cold-start retries, never runs the code.
  let current: ReturnType<typeof request> | undefined;
  let gone = false;
  res.once('close', () => {
    gone = !res.writableFinished;
    current?.destroy();
  });
  const payload = await body(req, 16 * 1024 * 1024);
  const address = await sandboxes.address(id);
  const deadline = Date.now() + 30_000;

  for (;;) {
    if (gone) return;
    try {
      return await new Promise<void>((resolve, reject) => {
        const upstream = (current = request(
          {
            host: address,
            port: CODE_PORT,
            // A fresh socket per run: a reused keep-alive one never emits `connect`
            // (so the timer below would cut a long run) and may be closed under us.
            agent: false,
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
        ));
        // A stopped container's address drops packets: without this the call would hang.
        const onStopped = (stopped: string) => {
          if (stopped === id) upstream.destroy(Object.assign(new Error('the sandbox stopped'), { code: 'ECONNRESET' }));
        };
        sandboxes.on('stopped', onStopped);
        upstream.on('close', () => sandboxes.off('stopped', onStopped));
        // Connecting is quick on a bridge; one that is not answering is not coming.
        upstream.on('socket', (socket) => {
          const timer = setTimeout(() => upstream.destroy(Object.assign(new Error('connect timeout'), { code: 'EHOSTUNREACH' })), 10_000);
          socket.once('connect', () => clearTimeout(timer));
          socket.once('close', () => clearTimeout(timer));
        });
        upstream.on('error', reject);
        upstream.end(payload);
      });
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      // Only a refused connection never reached the code server, so only it is
      // retried: a reset may come after the code ran, and must not run it again.
      if (!res.headersSent && code === 'ECONNREFUSED' && Date.now() <= deadline) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!res.headersSent && ['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'].includes(code ?? '')) {
        throw new Unavailable('the sandbox code server is not reachable');
      }
      throw e;
    }
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://lite');
  const parts = url.pathname.split('/').filter(Boolean);

  if (sandboxes.fromSandbox(req.socket.remoteAddress)) {
    return send(res, 403, { error: 'forbidden', message: 'not reachable from a sandbox' });
  }

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
    if (req.method === 'POST') {
      const sandbox = await sandboxes.create(await jsonBody(req));
      // The caller gave up (an image pull outlasting its timeout): nobody owns this sandbox.
      if (res.destroyed || req.socket.destroyed) {
        await sandboxes.kill(sandbox.id);
        return;
      }
      res.once('finish', () => void sandboxes.confirm(sandbox.id));
      return send(res, 201, view(sandbox));
    }
    if (req.method === 'GET') {
      const state = url.searchParams.get('state')?.split(',').filter(Boolean);
      const raw = url.searchParams.get('metadata');
      let metadata: Record<string, string> | undefined;
      if (raw) {
        try {
          metadata = JSON.parse(raw) as Record<string, string>;
        } catch {
          throw new BadRequest('metadata is not JSON');
        }
        if (!metadata || typeof metadata !== 'object') throw new BadRequest('metadata must be an object');
      }
      return send(res, 200, sandboxes.list({ state, metadata }).map(view));
    }
  } else if (!action) {
    if (req.method === 'GET') return send(res, 200, view(await sandboxes.fresh(id)));
    if (req.method === 'DELETE') {
      await sandboxes.kill(id);
      return send(res, 204);
    }
  } else if (req.method === 'POST' && action === 'timeout') {
    const { timeoutMs } = await jsonBody<{ timeoutMs: unknown }>(req);
    return send(res, 200, view(await sandboxes.setTimeout(id, timeoutMs)));
  } else if (req.method === 'POST' && action === 'pause') {
    await sandboxes.pause(id);
    return send(res, 200, view(sandboxes.get(id)));
  } else if (req.method === 'POST' && action === 'resume') {
    const { timeoutMs } = await jsonBody<{ timeoutMs?: unknown }>(req);
    const { sandbox, restarted } = await sandboxes.resume(id, timeoutMs);
    return send(res, 200, { ...view(sandbox), restarted });
  } else if (action === 'files') {
    const path = url.searchParams.get('path') ?? '';
    if (req.method === 'PUT') {
      const mode = Number.parseInt(url.searchParams.get('mode') ?? '644', 8);
      if (!(mode >= 0 && mode <= 0o7777)) throw new BadRequest('mode must be octal permissions');
      await sandboxes.writeFile(id, path, await body(req, MAX_FILE_BYTES), url.searchParams.get('user') ?? 'user', mode);
      return send(res, 204);
    }
    if (req.method === 'GET') {
      const data = await sandboxes.readFile(id, path);
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': data.length });
      return void res.end(data);
    }
  } else if (req.method === 'POST' && action === 'download-url') {
    const { path: asked, ttlSeconds } = await jsonBody<{ path: unknown; ttlSeconds?: unknown }>(req);
    const path = filePath(asked);
    sandboxes.get(id);
    const ttl = typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) ? ttlSeconds : 3600;
    const exp = Math.floor(Date.now() / 1000) + Math.floor(Math.min(Math.max(ttl, 60), 7 * 86400));
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
