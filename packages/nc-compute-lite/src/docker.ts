import { request, type IncomingMessage } from 'node:http';
import { config } from './config.ts';

/** Docker Engine API over its unix socket. Only the calls lite needs. */

const API = '/v1.43';

export class DockerError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function call(method: string, path: string, body?: unknown, raw?: Buffer): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const payload = raw ?? (body === undefined ? undefined : Buffer.from(JSON.stringify(body)));
    const req = request(
      {
        socketPath: config.dockerSocket,
        path: API + path,
        method,
        headers: payload
          ? {
              'content-type': raw ? 'application/x-tar' : 'application/json',
              'content-length': payload.length,
            }
          : {},
      },
      resolve,
    );
    // Idle, not total: a pull or a big archive keeps bytes moving, a frozen engine sends none.
    req.setTimeout(30_000, () =>
      req.destroy(Object.assign(new Error('the Docker engine did not answer'), { code: 'ETIMEDOUT' })),
    );
    req.on('error', reject);
    req.end(payload);
  });
}

async function read(res: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of res) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await call(method, path, body);
  const text = (await read(res)).toString('utf8');
  if ((res.statusCode ?? 500) >= 400) {
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      // not JSON
    }
    throw new DockerError(res.statusCode ?? 500, message);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export type ContainerSummary = {
  Id: string;
  Names: string[];
  State: string;
  Labels: Record<string, string>;
  Created: number;
};

export type ContainerInfo = {
  Id: string;
  State: { Running: boolean; Status: string; FinishedAt: string };
  Config: { Labels: Record<string, string>; Image: string };
  HostConfig: { NanoCpus: number; Memory: number };
  NetworkSettings: { Networks: Record<string, { IPAddress: string }> };
};

export const docker = {
  ping: () => json<unknown>('GET', '/_ping').catch(() => call('GET', '/_ping').then(read)),

  list: (label: string) =>
    json<ContainerSummary[]>(
      'GET',
      `/containers/json?all=true&filters=${encodeURIComponent(JSON.stringify({ label: [label] }))}`,
    ),

  inspect: (id: string) => json<ContainerInfo>('GET', `/containers/${id}/json`),

  create: (name: string, spec: unknown) =>
    json<{ Id: string }>('POST', `/containers/create?name=${encodeURIComponent(name)}`, spec),

  rename: (id: string, name: string) => json('POST', `/containers/${id}/rename?name=${encodeURIComponent(name)}`),

  start: async (id: string) => {
    const res = await call('POST', `/containers/${id}/start`);
    const text = (await read(res)).toString('utf8');
    if ((res.statusCode ?? 500) >= 400 && res.statusCode !== 304) throw new DockerError(res.statusCode ?? 500, text);
  },

  stop: async (id: string) => {
    const res = await call('POST', `/containers/${id}/stop?t=5`);
    await read(res);
    if ((res.statusCode ?? 500) >= 400 && res.statusCode !== 304) throw new DockerError(res.statusCode ?? 500, 'stop failed');
  },

  remove: async (id: string) => {
    const res = await call('DELETE', `/containers/${id}?force=true&v=true`);
    await read(res);
    // 404 gone already, 409 a removal already in progress (lite's own, or from outside).
    if ((res.statusCode ?? 500) >= 400 && res.statusCode !== 404 && res.statusCode !== 409) {
      throw new DockerError(res.statusCode ?? 500, 'remove failed');
    }
  },

  putFile: async (id: string, dir: string, tar: Buffer) => {
    const res = await call('PUT', `/containers/${id}/archive?path=${encodeURIComponent(dir)}`, undefined, tar);
    const text = (await read(res)).toString('utf8');
    if ((res.statusCode ?? 500) >= 400) throw new DockerError(res.statusCode ?? 500, text);
  },

  /** Stops reading past `limit`: the sandbox decides how big the file is. */
  getArchive: async (id: string, path: string, limit: number) => {
    const res = await call('GET', `/containers/${id}/archive?path=${encodeURIComponent(path)}`);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res) {
      size += (chunk as Buffer).length;
      if (size > limit) {
        res.destroy();
        throw new DockerError(413, `file larger than ${limit} bytes`);
      }
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);
    if ((res.statusCode ?? 500) >= 400) throw new DockerError(res.statusCode ?? 500, body.toString('utf8'));
    return body;
  },

  /** The engine's CPU architecture, in image terms (`amd64`, `arm64`). */
  arch: async () => {
    const { Architecture } = await json<{ Architecture: string }>('GET', '/info');
    // The engine reports the kernel's name; ppc64le, s390x and riscv64 read the same both ways.
    const names: Record<string, string> = { x86_64: 'amd64', aarch64: 'arm64', armv7l: 'arm', armv6l: 'arm' };
    return names[Architecture] ?? Architecture;
  },

  imageArch: async (image: string) =>
    (await json<{ Architecture: string }>('GET', `/images/${encodeURIComponent(image)}/json`)).Architecture,

  hasImage: async (image: string) => {
    const res = await call('GET', `/images/${encodeURIComponent(image)}/json`);
    await read(res);
    return res.statusCode === 200;
  },

  /** Resolves when the pull ends; the progress stream reports failures in-band. */
  pull: async (image: string) => {
    const res = await call('POST', `/images/create?fromImage=${encodeURIComponent(image)}`);
    const text = (await read(res)).toString('utf8');
    const failed = text.split('\n').find((line) => line.includes('"error"'));
    if ((res.statusCode ?? 500) >= 400 || failed) throw new DockerError(res.statusCode ?? 500, failed ?? text);
  },

  /** Returns the network's subnets. */
  ensureNetwork: async (name: string, internal: boolean): Promise<string[]> => {
    const subnets = async () =>
      (await json<{ IPAM: { Config: { Subnet?: string }[] | null } }>('GET', `/networks/${encodeURIComponent(name)}`))
        .IPAM.Config?.flatMap((c) => (c.Subnet ? [c.Subnet] : [])) ?? [];
    const existing = await json<{ Name: string }[]>(
      'GET',
      `/networks?filters=${encodeURIComponent(JSON.stringify({ name: [name] }))}`,
    );
    if (existing.some((n) => n.Name === name)) return subnets();
    await json('POST', '/networks/create', {
      Name: name,
      Driver: 'bridge',
      Internal: internal,
      Labels: { [config.label]: '1' },
      // No sandbox-to-sandbox traffic. Lite reaches them from the host side
      // (its own engine's namespace, or `--network host` in host mode).
      Options: { 'com.docker.network.bridge.enable_icc': 'false' },
    });
    return subnets();
  },
};
