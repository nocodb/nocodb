import { randomBytes } from 'node:crypto';
import { basename, dirname } from 'node:path';
import { config } from './config.ts';
import { docker, DockerError } from './docker.ts';
import { firstFile, packFile } from './tar.ts';

export class NotFound extends Error {}
export class Conflict extends Error {}
export class Capacity extends Error {}
export class BadRequest extends Error {}

export type CreateInput = {
  image: string;
  workload?: string;
  timeoutMs?: number;
  envs?: Record<string, string>;
  metadata?: Record<string, string>;
  egress?: { denyInternet?: boolean; allowOut?: string[] };
  ingress?: { requireAuth?: boolean };
  onTimeout?: 'pause' | 'kill';
  cpuCount?: number;
  memoryMB?: number;
};

export type Sandbox = {
  id: string;
  containerId: string;
  image: string;
  workload?: string;
  metadata: Record<string, string>;
  trafficToken?: string;
  onTimeout: 'pause' | 'kill';
  internal: boolean;
  cpuCount: number;
  memoryMB: number;
  state: 'running' | 'paused';
  deadline: number;
  pausedAt?: number;
  createdAt: string;
};

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const MAX_TIMEOUT_MS = 24 * 3600_000;
const L = config.label;

const clampTimeout = (ms?: number) => Math.min(Math.max(ms ?? DEFAULT_TIMEOUT_MS, 1_000), MAX_TIMEOUT_MS);

class Sandboxes {
  private items = new Map<string, Sandbox>();

  /** Rebuilds the registry from container labels, so a restart loses nothing but deadlines. */
  async init(): Promise<void> {
    await docker.ensureNetwork(config.network, false);
    await docker.ensureNetwork(config.internalNetwork, true);

    for (const c of await docker.list(`${L}=1`)) {
      const labels = c.Labels;
      const id = labels[`${L}.id`];
      if (!id) continue;
      const running = c.State === 'running';
      this.items.set(id, {
        id,
        containerId: c.Id,
        image: labels[`${L}.image`] ?? '',
        workload: labels[`${L}.workload`] || undefined,
        metadata: JSON.parse(labels[`${L}.metadata`] ?? '{}'),
        trafficToken: labels[`${L}.token`] || undefined,
        onTimeout: labels[`${L}.on-timeout`] === 'pause' ? 'pause' : 'kill',
        internal: labels[`${L}.internal`] === '1',
        cpuCount: Number(labels[`${L}.cpu`] ?? 2),
        memoryMB: Number(labels[`${L}.memory`] ?? 1024),
        state: running ? 'running' : 'paused',
        deadline: Date.now() + DEFAULT_TIMEOUT_MS,
        pausedAt: running ? undefined : Date.now(),
        createdAt: new Date(c.Created * 1000).toISOString(),
      });
    }

    setInterval(() => void this.sweep(), 2_000).unref();
  }

  get(id: string): Sandbox {
    const sandbox = this.items.get(id);
    if (!sandbox) throw new NotFound(`sandbox ${id} not found`);
    return sandbox;
  }

  list(filter: { metadata?: Record<string, string>; state?: string[] }): Sandbox[] {
    return [...this.items.values()].filter(
      (s) =>
        (!filter.state?.length || filter.state.includes(s.state)) &&
        Object.entries(filter.metadata ?? {}).every(([k, v]) => s.metadata[k] === v),
    );
  }

  async create(input: CreateInput): Promise<Sandbox> {
    if (!/^[\w.\-/:@]+$/.test(input.image ?? '')) throw new BadRequest('image is required');
    if (input.egress?.allowOut?.length) {
      throw new BadRequest('egress allowlists are not supported; use denyInternet');
    }
    if (this.list({ state: ['running'] }).length >= config.maxSandboxes) {
      throw new Capacity(`at most ${config.maxSandboxes} sandboxes run at once`);
    }

    if (!(await docker.hasImage(input.image))) await docker.pull(input.image);

    const id = `nl${randomBytes(10).toString('hex')}`;
    const internal = !!input.egress?.denyInternet;
    const cpuCount = input.cpuCount ?? 2;
    const memoryMB = input.memoryMB ?? 1024;
    const trafficToken = input.ingress?.requireAuth ? randomBytes(24).toString('hex') : undefined;
    const onTimeout = input.onTimeout === 'pause' ? 'pause' : 'kill';
    const metadata = input.metadata ?? {};

    const { Id } = await docker.create(`nc-lite-${id}`, {
      Image: input.image,
      Hostname: 'sandbox',
      Env: Object.entries(input.envs ?? {}).map(([k, v]) => `${k}=${v}`),
      Labels: {
        [L]: '1',
        [`${L}.id`]: id,
        [`${L}.image`]: input.image,
        [`${L}.workload`]: input.workload ?? '',
        [`${L}.metadata`]: JSON.stringify(metadata),
        [`${L}.token`]: trafficToken ?? '',
        [`${L}.on-timeout`]: onTimeout,
        [`${L}.internal`]: internal ? '1' : '0',
        [`${L}.cpu`]: String(cpuCount),
        [`${L}.memory`]: String(memoryMB),
      },
      HostConfig: {
        NetworkMode: internal ? config.internalNetwork : config.network,
        NanoCpus: cpuCount * 1e9,
        Memory: memoryMB * 1024 * 1024,
        MemorySwap: memoryMB * 1024 * 1024,
        PidsLimit: 4096,
        Init: true,
        CapDrop: ['NET_RAW'],
        RestartPolicy: { Name: 'no' },
      },
    });

    try {
      await docker.start(Id);
    } catch (e) {
      await docker.remove(Id).catch(() => undefined);
      throw e;
    }

    const sandbox: Sandbox = {
      id,
      containerId: Id,
      image: input.image,
      workload: input.workload,
      metadata,
      trafficToken,
      onTimeout,
      internal,
      cpuCount,
      memoryMB,
      state: 'running',
      deadline: Date.now() + clampTimeout(input.timeoutMs),
      createdAt: new Date().toISOString(),
    };
    this.items.set(id, sandbox);
    return sandbox;
  }

  /** Doubles as a liveness check: a paused, crashed or missing sandbox is refused. */
  async setTimeout(id: string, timeoutMs: number): Promise<Sandbox> {
    const sandbox = this.get(id);
    if (sandbox.state !== 'running') throw new Conflict(`sandbox ${id} is paused`);
    const info = await docker.inspect(sandbox.containerId).catch((e) => {
      if (e instanceof DockerError && e.status === 404) this.items.delete(id);
      throw e;
    });
    if (!info.State.Running) {
      // Exited on its own: its files are still there, so it reads as paused.
      sandbox.state = 'paused';
      sandbox.pausedAt = Date.now();
      throw new Conflict(`sandbox ${id} is not running`);
    }
    sandbox.deadline = Date.now() + clampTimeout(timeoutMs);
    return sandbox;
  }

  /** Files survive; processes and memory do not. */
  async pause(id: string): Promise<void> {
    const sandbox = this.get(id);
    if (sandbox.state === 'paused') return;
    await docker.stop(sandbox.containerId);
    sandbox.state = 'paused';
    sandbox.pausedAt = Date.now();
  }

  async resume(id: string, timeoutMs?: number): Promise<Sandbox> {
    const sandbox = this.get(id);
    if (sandbox.state === 'paused') {
      if (this.list({ state: ['running'] }).length >= config.maxSandboxes) {
        throw new Capacity(`at most ${config.maxSandboxes} sandboxes run at once`);
      }
      await docker.start(sandbox.containerId);
      sandbox.state = 'running';
      sandbox.pausedAt = undefined;
    }
    sandbox.deadline = Date.now() + clampTimeout(timeoutMs);
    return sandbox;
  }

  async kill(id: string): Promise<void> {
    const sandbox = this.items.get(id);
    if (!sandbox) return;
    this.items.delete(id);
    await docker.remove(sandbox.containerId);
  }

  async address(id: string): Promise<string> {
    const sandbox = this.get(id);
    if (sandbox.state !== 'running') throw new Conflict(`sandbox ${id} is paused`);
    const info = await docker.inspect(sandbox.containerId);
    const net = info.NetworkSettings.Networks[sandbox.internal ? config.internalNetwork : config.network];
    if (!net?.IPAddress) throw new Conflict(`sandbox ${id} has no address`);
    return net.IPAddress;
  }

  /** A user's uid and gid from the image's own passwd: `user` is not 1000 on every base. */
  private async ids(sandbox: Sandbox, user: string): Promise<{ uid: number; gid: number }> {
    if (user === 'root') return { uid: 0, gid: 0 };
    const passwd = (await this.readFile(sandbox.id, '/etc/passwd')).toString('utf8');
    const entry = passwd.split('\n').find((line) => line.startsWith(`${user}:`))?.split(':');
    if (!entry) throw new BadRequest(`no user '${user}' in the sandbox`);
    return { uid: Number(entry[2]), gid: Number(entry[3]) };
  }

  async writeFile(id: string, path: string, data: Buffer, user: string, mode: number): Promise<void> {
    const sandbox = this.get(id);
    if (!path.startsWith('/') || path.includes('/../')) throw new BadRequest('path must be absolute');
    const { uid, gid } = await this.ids(sandbox, user);

    try {
      await docker.putFile(sandbox.containerId, dirname(path), packFile(basename(path), data, { mode, uid, gid }));
    } catch (e) {
      // A missing directory: written from the root instead, which creates it.
      if (!(e instanceof DockerError) || e.status !== 404) throw e;
      await docker.putFile(sandbox.containerId, '/', packFile(path.slice(1), data, { mode, uid, gid }));
    }
  }

  async readFile(id: string, path: string): Promise<Buffer> {
    const sandbox = this.get(id);
    try {
      return firstFile(await docker.getArchive(sandbox.containerId, path));
    } catch (e) {
      if (e instanceof DockerError && e.status === 404) throw new NotFound(`no file at ${path}`);
      throw e;
    }
  }

  private sweeping = false;

  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const now = Date.now();
      for (const sandbox of [...this.items.values()]) {
        try {
          if (sandbox.state === 'running' && now > sandbox.deadline) {
            if (sandbox.onTimeout === 'pause') await this.pause(sandbox.id);
            else await this.kill(sandbox.id);
          } else if (sandbox.state === 'paused' && now - (sandbox.pausedAt ?? now) > config.pausedRetentionMs) {
            await this.kill(sandbox.id);
          }
        } catch (e) {
          console.error(JSON.stringify({ level: 'error', msg: 'sweep failed', id: sandbox.id, error: String(e) }));
        }
      }
    } finally {
      this.sweeping = false;
    }
  }
}

export const sandboxes = new Sandboxes();
