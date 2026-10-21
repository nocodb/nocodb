/**
 * Against a running lite: the calls NocoDB's machine provider makes.
 *   LITE_URL=http://127.0.0.1:8430 LITE_PROXY=127.0.0.1:8431 NC_COMPUTE_LITE_KEY=… IMAGE=… node test/e2e.ts
 */
import { request } from 'node:http';

const API = process.env.LITE_URL ?? 'http://127.0.0.1:8430';
const [proxyHost, proxyPort] = (process.env.LITE_PROXY ?? '127.0.0.1:8431').split(':');
const KEY = process.env.NC_COMPUTE_LITE_KEY!;
const IMAGE = process.env.IMAGE!;
const AGENT_PORT = 49990;

let failed = 0;
const check = (ok: boolean, what: string, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

async function api(method: string, path: string, body?: unknown, raw?: Buffer) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${KEY}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  return { status: res.status, text, json: text ? (() => { try { return JSON.parse(text); } catch { return undefined; } })() : undefined };
}

/** Through the port proxy, by hostname, as NocoDB reaches a sandbox port. */
function viaProxy(id: string, port: number, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request(
      { host: proxyHost, port: Number(proxyPort), path, headers: { host: `${port}-${id}.lite.test`, ...headers } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 30_000): Promise<T> {
  const end = Date.now() + ms;
  let last = await fn();
  while (!ok(last) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    last = await fn();
  }
  return last;
}

async function runCode(id: string, code: string) {
  const res = await api('POST', `/v1/sandboxes/${id}/code/execute`, { code, language: 'python' });
  return res.text;
}

const health = await api('GET', '/health');
check(health.status === 200, 'health', health.text);

const t0 = Date.now();
const created = await api('POST', '/v1/sandboxes', {
  image: IMAGE,
  workload: 'script',
  timeoutMs: 120_000,
  metadata: { purpose: 'e2e' },
  ingress: { requireAuth: true },
});
check(created.status === 201 && !!created.json?.trafficToken, 'create with requireAuth', `${Date.now() - t0}ms ${created.text.slice(0, 120)}`);
// Without requireAuth too: no port is public on lite.
const open = await api('POST', '/v1/sandboxes', { image: IMAGE, timeoutMs: 60_000 });
check(open.status === 201 && !!open.json?.trafficToken, 'every sandbox gets a traffic token');
if (open.json?.id) await api('DELETE', `/v1/sandboxes/${open.json.id}`);
const id: string = created.json.id;
const traffic = { 'e2b-traffic-access-token': created.json.trafficToken };

const noToken = await viaProxy(id, AGENT_PORT, '/health');
check(noToken.status === 403, 'proxy refuses a caller without the traffic token', String(noToken.status));

// The machine contract: the agent answers 401 until the backend writes its token through the provider.
const before = await waitFor(() => viaProxy(id, AGENT_PORT, '/health', traffic), (r) => r.status === 401 || r.status === 200);
check(before.status === 401, 'agent up, no token yet → 401', `${before.status} ${before.body.slice(0, 80)}`);

const agentToken = 'e2e-agent-token-0123456789abcdef';
const wrote = await api('PUT', `/v1/sandboxes/${id}/files?path=${encodeURIComponent('/tmp/.nc-agent/token')}&user=user&mode=600`, undefined, Buffer.from(agentToken));
check(wrote.status === 204, 'write agent token as user', String(wrote.status));
const after = await waitFor(() => viaProxy(id, AGENT_PORT, '/health', { ...traffic, 'x-nc-agent-token': agentToken }), (r) => r.status === 200);
check(after.status === 200 && after.body.includes('protocol'), 'agent /health with token → 200', after.body.slice(0, 100));

const code = await waitFor(() => runCode(id, 'print(6*7)'), (t) => t.includes('42'), 60_000);
check(code.includes('42'), 'run code through the code server', code.slice(0, 120));

await api('PUT', `/v1/sandboxes/${id}/files?path=${encodeURIComponent('/home/user/keep.txt')}&user=user`, undefined, Buffer.from('kept'));
// A path that resolves to a directory would make Docker replace it (`/tmp/..` is `/`).
for (const bad of ['/home/user/', '/tmp/..', '/tmp/.', '/']) {
  const r = await api('PUT', `/v1/sandboxes/${id}/files?path=${encodeURIComponent(bad)}`, undefined, Buffer.from('x'));
  check(r.status === 400, `refuses to write ${bad}`, String(r.status));
}
const dir = await api('GET', `/v1/sandboxes/${id}/files?path=${encodeURIComponent('/home/user')}`);
check(dir.status === 400, 'reading a directory is refused, not its first file', String(dir.status));
const link = await api('POST', `/v1/sandboxes/${id}/download-url`, { path: '/home/user/keep.txt', ttlSeconds: 120 });
const download = await fetch(API + link.json.url);
check(download.status === 200 && (await download.text()) === 'kept', 'signed download URL, no API key');
const forged = await fetch(API + link.json.url.replace(/sig=[^&]+/, 'sig=forged'));
check(forged.status === 403, 'forged download link refused', String(forged.status));

const alive = await api('POST', `/v1/sandboxes/${id}/timeout`, { timeoutMs: 60_000 });
check(alive.status === 200, 'setTimeout on a running sandbox');
await api('POST', `/v1/sandboxes/${id}/pause`);
const pausedTimeout = await api('POST', `/v1/sandboxes/${id}/timeout`, { timeoutMs: 60_000 });
check(pausedTimeout.status === 409, 'setTimeout on a paused sandbox fails (liveness)', String(pausedTimeout.status));
const listed = await api('GET', `/v1/sandboxes?state=paused&metadata=${encodeURIComponent(JSON.stringify({ purpose: 'e2e' }))}`);
check(listed.json?.some((s: { id: string }) => s.id === id), 'list by state and metadata');
const resumed = await api('POST', `/v1/sandboxes/${id}/resume`, { timeoutMs: 60_000 });
check(resumed.json?.state === 'running', 'resume', resumed.text.slice(0, 80));
check(resumed.json?.restarted === true, 'resume reports the restart');
const again = await api('POST', `/v1/sandboxes/${id}/resume`, { timeoutMs: 60_000 });
check(again.json?.restarted === false, 'resuming a running sandbox restarts nothing');
const kept = await api('GET', `/v1/sandboxes/${id}/files?path=${encodeURIComponent('/home/user/keep.txt')}`);
check(kept.text === 'kept', 'files survive pause/resume');
const agentAgain = await waitFor(() => viaProxy(id, AGENT_PORT, '/health', { ...traffic, 'x-nc-agent-token': agentToken }), (r) => r.status === 200);
check(agentAgain.status === 200, 'agent back after resume');

const offline = await api('POST', '/v1/sandboxes', { image: IMAGE, egress: { denyInternet: true }, timeoutMs: 60_000 });
const net = await waitFor(
  () => runCode(offline.json.id, "import urllib.request\ntry:\n  urllib.request.urlopen('https://example.com', timeout=5); print('ONLINE')\nexcept Exception as e: print('OFFLINE', type(e).__name__)"),
  (t) => t.includes('ONLINE') || t.includes('OFFLINE'),
  60_000,
);
check(net.includes('OFFLINE'), 'denyInternet blocks the internet', net.match(/(ONLINE|OFFLINE[^"\\]*)/)?.[0]);
const online = await waitFor(
  () => runCode(id, "import urllib.request\nprint('STATUS', urllib.request.urlopen('https://example.com', timeout=10).status)"),
  (t) => t.includes('STATUS'),
  60_000,
);
check(online.includes('STATUS 200'), 'default sandbox reaches the internet');

const allowOut = await api('POST', '/v1/sandboxes', { image: IMAGE, egress: { allowOut: ['example.com'] } });
check(allowOut.status === 400, 'allowOut refused, not ignored', allowOut.text.slice(0, 80));

for (const s of [id, offline.json.id]) await api('DELETE', `/v1/sandboxes/${s}`);
const gone = await api('GET', `/v1/sandboxes/${id}`);
check(gone.status === 404, 'kill → gone');
const unauth = await fetch(API + '/v1/sandboxes');
check(unauth.status === 401, 'API without key → 401');

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
