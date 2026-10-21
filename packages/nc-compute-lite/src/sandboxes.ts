import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { BlockList, isIP } from 'node:net';
import { basename, dirname, posix } from 'node:path';
import { config } from './config.ts';
import { docker, DockerError } from './docker.ts';
import { firstFile, packFile, TarError } from './tar.ts';

export class NotFound extends Error {}
/** The sandbox itself is unknown: NocoDB reads this, and only this, as a machine that is gone. */
export class Gone extends NotFound {}
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
const PENDING = 'nc-lite-pending-';

/** Largest file lite reads out of a sandbox; the sandbox controls its size. */
export const MAX_READ_BYTES = 256 * 1024 * 1024;

export const clampTimeout = (ms?: unknown) => {
  if (ms === undefined || ms === null) return DEFAULT_TIMEOUT_MS;
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new BadRequest('timeoutMs must be a number');
  return Math.min(Math.max(ms, 1_000), MAX_TIMEOUT_MS);
};

/** Docker reads 0 as unlimited, so a limit is always a bounded positive number. */
export const limit = (value: unknown, name: string, fallback: number, min: number, max: number) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequest(`${name} must be a number from ${min} to ${max}`);
  }
  return value;
};

/**
 * A file path, already normal: absolute, no `.`/`..` segments, no repeated or
 * trailing slash, not `/`. Docker's archive endpoints would otherwise act on
 * the directory it resolves to (`/tmp/..` replaces `/`).
 */
export const filePath = (path: unknown): string => {
  if (typeof path !== 'string' || path === '/' || !path.startsWith('/') || posix.normalize(path) !== path || path.endsWith('/')) {
    throw new BadRequest('path must be a normal absolute file path');
  }
  return path;
};

const parseMetadata = (raw: string | undefined): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/** An address as its family sees it: `::ffff:1.2.3.4` is IPv4. */
export const family = (address: string): { address: string; type: 'ipv4' | 'ipv6' } | undefined => {
  const plain = address.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
  const v = isIP(plain);
  return v === 4 ? { address: plain, type: 'ipv4' } : v === 6 ? { address: plain, type: 'ipv6' } : undefined;
};

/** Emits `stopped` (id) when lite pauses or removes a sandbox, so calls into it end instead of hanging. */
class Sandboxes extends EventEmitter {
  constructor() {
    super();
    // One listener per in-flight code call.
    this.setMaxListeners(0);
  }

  private items = new Map<string, Sandbox>();
  /** Creates and resumes in flight, counted against capacity before their first await. */
  private starting = 0;
  private sandboxNets = new BlockList();

  /** Rebuilds the registry from container labels, so a restart loses nothing but deadlines. */
  async init(): Promise<void> {
    const cidrs = [
      ...(await docker.ensureNetwork(config.network, false)),
      ...(await docker.ensureNetwork(config.internalNetwork, true)),
    ];
    for (const cidr of cidrs) {
      const [addr, bits] = cidr.split('/');
      const net = family(addr ?? '');
      if (net) this.sandboxNets.addSubnet(net.address, Number(bits), net.type);
    }
    // Without them lite cannot tell a sandbox from NocoDB, and would answer both.
    if (!this.sandboxNets.rules.length) throw new Error('could not read the sandbox networks\' subnets');

    for (const c of await docker.list(`${L}=1`)) {
      const labels = c.Labels;
      const id = labels[`${L}.id`];
      if (!id) continue;
      // A removal a restart interrupted, or a create whose caller never got the
      // sandbox: finish it rather than bring back one nobody owns.
      if (c.State === 'dead' || c.State === 'removing' || c.Names.some((n) => n.startsWith(`/${PENDING}`))) {
        await docker.remove(c.Id).catch(() => undefined);
        continue;
      }
      const running = c.State === 'running';
      // Only a sandbox meant to pause is worth keeping stopped: a kill-at-deadline
      // one that stopped (it exited, or an embedded restart stopped it) is done.
      if (!running && labels[`${L}.on-timeout`] !== 'pause') {
        await docker.remove(c.Id).catch(() => undefined);
        continue;
      }
      this.items.set(id, {
        id,
        containerId: c.Id,
        image: labels[`${L}.image`] ?? '',
        workload: labels[`${L}.workload`] || undefined,
        metadata: parseMetadata(labels[`${L}.metadata`]),
        trafficToken: labels[`${L}.token`] || undefined,
        onTimeout: labels[`${L}.on-timeout`] === 'pause' ? 'pause' : 'kill',
        internal: labels[`${L}.internal`] === '1',
        cpuCount: Number(labels[`${L}.cpu`] ?? 2),
        memoryMB: Number(labels[`${L}.memory`] ?? 1024),
        state: running ? 'running' : 'paused',
        // The deadline itself is lost; the length it was created with is not.
        deadline: Date.now() + (Number(labels[`${L}.timeout`]) || DEFAULT_TIMEOUT_MS),
        pausedAt: running ? undefined : Date.now(),
        createdAt: new Date(c.Created * 1000).toISOString(),
      });
    }

    setInterval(() => void this.sweep(), 2_000).unref();
  }

  /**
   * A connection from a sandbox network. Sandboxes reach lite's ports at their
   * gateway; answering them would relay one sandbox into another, or out of `denyInternet`.
   */
  fromSandbox(remoteAddress: string | undefined): boolean {
    const ip = family(remoteAddress ?? '');
    return !!ip && this.sandboxNets.check(ip.address, ip.type);
  }

  private reserve(): () => void {
    if (this.list({ state: ['running'] }).length + this.starting >= config.maxSandboxes) {
      throw new Capacity(`at most ${config.maxSandboxes} sandboxes run at once`);
    }
    this.starting++;
    let released = false;
    return () => {
      if (!released) this.starting--;
      released = true;
    };
  }

  get(id: string): Sandbox {
    const sandbox = this.items.get(id);
    // Being removed: already gone to every caller but the removal itself.
    if (!sandbox || this.killing.has(id)) throw new Gone(`sandbox ${id} not found`);
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
    if (!input || typeof input !== 'object') throw new BadRequest('body must be an object');
    if (typeof input.image !== 'string' || !/^[\w.\-/:@]+$/.test(input.image)) throw new BadRequest('image is required');
    if (input.egress?.allowOut?.length) {
      throw new BadRequest('egress allowlists are not supported; use denyInternet');
    }
    const strings = (value: unknown, name: string): Record<string, string> => {
      if (value === undefined || value === null) return {};
      if (typeof value !== 'object' || Array.isArray(value) || Object.values(value).some((v) => typeof v !== 'string')) {
        throw new BadRequest(`${name} must be an object of strings`);
      }
      return value as Record<string, string>;
    };
    const envs = strings(input.envs, 'envs');
    if (Object.keys(envs).some((k) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))) throw new BadRequest('envs keys must be variable names');
    const metadata = strings(input.metadata, 'metadata');
    if (input.workload !== undefined && typeof input.workload !== 'string') throw new BadRequest('workload must be a string');
    for (const key of ['egress', 'ingress'] as const) {
      const v: unknown = input[key];
      if (v !== undefined && v !== null && (typeof v !== 'object' || Array.isArray(v))) throw new BadRequest(`${key} must be an object`);
    }
    if (input.onTimeout !== undefined && input.onTimeout !== 'pause' && input.onTimeout !== 'kill') {
      throw new BadRequest("onTimeout must be 'pause' or 'kill'");
    }
    const cpuCount = limit(input.cpuCount, 'cpuCount', 2, 0.25, 64);
    const memoryMB = limit(input.memoryMB, 'memoryMB', 1024, 128, 262_144);
    const timeoutMs = clampTimeout(input.timeoutMs);
    const release = this.reserve();
    try {
      return await this.start(input, { envs, metadata, cpuCount, memoryMB, timeoutMs });
    } finally {
      release();
    }
  }

  private async start(
    input: CreateInput,
    opts: { envs: Record<string, string>; metadata: Record<string, string>; cpuCount: number; memoryMB: number; timeoutMs: number },
  ): Promise<Sandbox> {
    const { envs, metadata, cpuCount, memoryMB } = opts;
    if (!(await docker.hasImage(input.image))) {
      // Docker's 404 here is an unknown image, not a machine that is gone.
      await docker.pull(input.image).catch((e) => {
        throw e instanceof DockerError && e.status === 404 ? new BadRequest(`image ${input.image} not found`) : e;
      });
    }
    // Docker pulls a single-arch image for another CPU without a word, then it fails to start or runs emulated.
    const imageArch = await docker.imageArch(input.image).catch((e) => {
      // Pruned between the pull and here: still an image problem, never a gone machine.
      throw e instanceof DockerError && e.status === 404 ? new BadRequest(`image ${input.image} not found`) : e;
    });
    this.hostArch ??= await docker.arch();
    if (imageArch !== this.hostArch) {
      throw new BadRequest(`image ${input.image} is built for ${imageArch}; this Docker host is ${this.hostArch}`);
    }

    const id = `nl${randomBytes(10).toString('hex')}`;
    this.startedAt.set(id, Date.now());
    const internal = !!input.egress?.denyInternet;
    // Always, whatever `requireAuth` says: sandboxes reach the proxy through the
    // host's published ports with their source address rewritten, so only a
    // token keeps one sandbox out of another's ports. NocoDB sends it on every call.
    const trafficToken = randomBytes(24).toString('hex');
    const onTimeout = input.onTimeout === 'pause' ? 'pause' : 'kill';

    // Pending until its caller has the answer (`confirm`): one a restart cuts off is removed at boot.
    const { Id } = await docker.create(`${PENDING}${id}`, {
      Image: input.image,
      Hostname: 'sandbox',
      Env: Object.entries(envs).map(([k, v]) => `${k}=${v}`),
      Labels: {
        [L]: '1',
        [`${L}.id`]: id,
        [`${L}.image`]: input.image,
        [`${L}.workload`]: input.workload ?? '',
        [`${L}.metadata`]: JSON.stringify(metadata),
        [`${L}.token`]: trafficToken,
        [`${L}.on-timeout`]: onTimeout,
        [`${L}.internal`]: internal ? '1' : '0',
        [`${L}.cpu`]: String(cpuCount),
        [`${L}.memory`]: String(memoryMB),
        [`${L}.timeout`]: String(opts.timeoutMs),
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
    }).catch((e) => {
      this.startedAt.delete(id);
      // Docker's 404 on create is the image (pruned meanwhile), not a machine.
      throw e instanceof DockerError && e.status === 404 ? new BadRequest(`image ${input.image} not found`) : e;
    });

    try {
      await docker.start(Id);
    } catch (e) {
      this.startedAt.delete(id);
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
      deadline: Date.now() + opts.timeoutMs,
      createdAt: new Date().toISOString(),
    };
    this.items.set(id, sandbox);
    return sandbox;
  }

  /** Doubles as a liveness check: a paused, crashed or missing sandbox is refused. */
  async setTimeout(id: string, timeoutMs: unknown): Promise<Sandbox> {
    const ms = clampTimeout(timeoutMs);
    const sandbox = this.get(id);
    if (sandbox.state !== 'running') throw new Conflict(`sandbox ${id} is paused`);
    const info = await docker.inspect(sandbox.containerId).catch((e) => {
      if (e instanceof DockerError && e.status === 404) this.items.delete(id);
      throw e;
    });
    if (!info.State.Running) {
      // Exited on its own: one meant to pause keeps its files and reads as
      // paused; one meant to be killed is done with.
      if (sandbox.onTimeout === 'kill') {
        await this.kill(id);
        throw new Gone(`sandbox ${id} not found`);
      }
      sandbox.state = 'paused';
      sandbox.pausedAt = Date.now();
      throw new Conflict(`sandbox ${id} is not running`);
    }
    sandbox.deadline = Date.now() + ms;
    return sandbox;
  }

  /**
   * One sandbox as its container is now, not as of the last reconcile: one
   * removed from outside is gone, one whose process exited reads as paused.
   * An op in flight decides the state itself, so it is left alone.
   */
  async fresh(id: string): Promise<Sandbox> {
    const sandbox = this.get(id);
    if (sandbox.state !== 'running' || this.chains.has(id)) return sandbox;
    const info = await docker.inspect(sandbox.containerId).catch((e) => {
      if (e instanceof DockerError && e.status === 404) {
        this.items.delete(id);
        throw new Gone(`sandbox ${id} not found`);
      }
      throw e;
    });
    if (!info.State.Running && sandbox.state === 'running' && !this.chains.has(id)) {
      if (sandbox.onTimeout === 'kill') {
        await this.kill(id);
        throw new Gone(`sandbox ${id} not found`);
      }
      sandbox.state = 'paused';
      sandbox.pausedAt = Date.now();
    }
    return sandbox;
  }

  /**
   * The caller has the sandbox: it now survives a restart. Retried, since a
   * sandbox left under its pending name would be removed at the next boot.
   */
  async confirm(id: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const sandbox = this.items.get(id);
      if (!sandbox || this.killing.has(id)) return;
      try {
        await docker.rename(sandbox.containerId, `nc-lite-${id}`);
        return;
      } catch (e) {
        if (attempt === 2) {
          console.error(JSON.stringify({ level: 'error', msg: 'confirm rename failed', id, error: String(e) }));
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  /**
   * Pause, resume and kill of one sandbox run one at a time, in arrival order:
   * each sees the state the previous one left, so none acts on a sandbox that
   * is mid-stop or mid-start.
   */
  private serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const run = (this.chains.get(id) ?? Promise.resolve()).then(fn);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(id, tail);
    void tail.then(() => {
      if (this.chains.get(id) === tail) this.chains.delete(id);
    });
    return run;
  }

  async pause(id: string): Promise<void> {
    const inFlight = this.pausing.get(id);
    if (inFlight) return inFlight;
    const done = this.serial(id, async () => {
      const sandbox = this.get(id);
      if (sandbox.state === 'paused') return;
      await docker.stop(sandbox.containerId);
      this.emit('stopped', id);
      sandbox.state = 'paused';
      sandbox.pausedAt = Date.now();
    });
    this.pausing.set(id, done);
    try {
      await done;
    } finally {
      if (this.pausing.get(id) === done) this.pausing.delete(id);
    }
  }

  /** `restarted`: the container was stopped and started again, so its processes and memory are gone. */
  async resume(id: string, timeoutMs?: unknown): Promise<{ sandbox: Sandbox; restarted: boolean }> {
    const ms = clampTimeout(timeoutMs);
    this.get(id);
    const asked = Date.now();
    const done = this.serial(id, async () => {
      const sandbox = this.get(id);
      // Running by the registry, but its process may have exited since the last reconcile.
      if (sandbox.state === 'running') {
        const info = await docker.inspect(sandbox.containerId).catch((e) => {
          if (e instanceof DockerError && e.status === 404) {
            this.items.delete(id);
            throw new Gone(`sandbox ${id} not found`);
          }
          throw e;
        });
        if (!info.State.Running) {
          sandbox.state = 'paused';
          sandbox.pausedAt = Date.now();
        }
      }
      if (sandbox.state === 'paused') {
        const release = this.reserve();
        try {
          this.startedAt.set(id, Date.now());
          await docker.start(sandbox.containerId);
          this.startedAt.set(id, Date.now());
        } finally {
          release();
        }
        sandbox.state = 'running';
        sandbox.pausedAt = undefined;
        sandbox.deadline = Date.now() + ms;
      } else {
        // As E2B: a running sandbox's deadline only moves later.
        sandbox.deadline = Math.max(sandbox.deadline, Date.now() + ms);
      }
      // A start since this call arrived (its own, or one queued ahead of it) lost the memory too.
      return { sandbox, restarted: (this.startedAt.get(id) ?? 0) >= asked };
    });
    return done;
  }

  /**
   * Out of the registry only once the container is: a restart mid-removal must
   * not bring back a sandbox already reported killed. Concurrent kills share one removal.
   */
  async kill(id: string): Promise<void> {
    const inFlight = this.killing.get(id);
    if (inFlight) return inFlight;
    const sandbox = this.items.get(id);
    if (!sandbox) return;
    // Marked at once, so every other caller sees it as gone while it waits its turn.
    const done = this.serial(id, async () => {
      await docker.remove(sandbox.containerId);
      this.emit('stopped', id);
      this.items.delete(id);
      this.startedAt.delete(id);
      this.sweepErrors.delete(id);
    });
    this.killing.set(id, done);
    try {
      await done;
    } finally {
      this.killing.delete(id);
    }
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
    const uid = Number(entry[2]);
    const gid = Number(entry[3]);
    // The image's passwd is sandbox-controlled; a tar header field holds 7 octal digits.
    const ok = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0o7777777;
    if (!ok(uid) || !ok(gid)) throw new BadRequest(`user '${user}' has an invalid uid or gid`);
    return { uid, gid };
  }

  async writeFile(id: string, path: string, data: Buffer, user: string, mode: number): Promise<void> {
    const sandbox = this.get(id);
    filePath(path);
    const { uid, gid } = await this.ids(sandbox, user);
    const pack = (name: string) => {
      try {
        return packFile(name, data, { mode, uid, gid });
      } catch (e) {
        throw new BadRequest((e as Error).message);
      }
    };

    try {
      await docker.putFile(sandbox.containerId, dirname(path), pack(basename(path)));
    } catch (e) {
      // A missing directory: written from the root instead, which creates it.
      if (!(e instanceof DockerError) || e.status !== 404) throw e;
      await docker.putFile(sandbox.containerId, '/', pack(path.slice(1)));
    }
  }

  async readFile(id: string, path: string): Promise<Buffer> {
    const sandbox = this.get(id);
    filePath(path);
    try {
      return firstFile(await docker.getArchive(sandbox.containerId, path, MAX_READ_BYTES + 64 * 1024));
    } catch (e) {
      if (e instanceof DockerError && e.status === 404) {
        // The container went away under its entry, or the file is not there.
        if (/no such container/i.test(e.message)) {
          this.items.delete(id);
          throw new Gone(`sandbox ${id} not found`);
        }
        throw new NotFound(`no file at ${path}`);
      }
      if (e instanceof DockerError && e.status === 413) throw new BadRequest(e.message);
      if (e instanceof TarError) throw new BadRequest(`${path}: ${e.message}`);
      throw e;
    }
  }

  private sweeping = false;
  private reconciledAt = 0;
  /** When each sandbox last began starting, so a reconcile does not act on a listing older than that. */
  private startedAt = new Map<string, number>();
  private killing = new Map<string, Promise<void>>();
  private pausing = new Map<string, Promise<void>>();
  private chains = new Map<string, Promise<void>>();
  private sweepErrors = new Map<string, string>();
  private hostArch?: string;

  private async sweep(): Promise<void> {
    // Due sandboxes first and never awaited: a stop takes seconds, and waiting
    // for one batch would leave the next tick's deadlines late. pause() and
    // kill() each share an in-flight call, so a later tick cannot double one.
    const now = Date.now();
    for (const sandbox of this.items.values()) {
      // Anything in flight for it decides its state first.
      if (this.chains.has(sandbox.id)) continue;
      const due =
        sandbox.state === 'running' && now > sandbox.deadline
          ? sandbox.onTimeout === 'pause'
            ? () => this.pause(sandbox.id)
            : () => this.kill(sandbox.id)
          : sandbox.state === 'paused' && now - (sandbox.pausedAt ?? now) > config.pausedRetentionMs
            ? () => this.kill(sandbox.id)
            : undefined;
      // Retried every tick; logged once per distinct error, not every 2s while the engine is down.
      due?.()
        .then(() => this.sweepErrors.delete(sandbox.id))
        .catch((e) => {
          if (this.sweepErrors.get(sandbox.id) === String(e)) return;
          this.sweepErrors.set(sandbox.id, String(e));
          console.error(JSON.stringify({ level: 'error', msg: 'sweep failed', id: sandbox.id, error: String(e) }));
        });
    }

    if (this.sweeping) return;
    this.sweeping = true;
    try {
      // A container whose process exited holds no capacity: it reads as paused.
      // One removed from outside lite is dropped. Only sandboxes registered
      // before the listing, and not started (begun or finished) since: a create
      // or resume racing the listing is not judged by it.
      if (Date.now() - this.reconciledAt > 30_000) {
        const listedAt = (this.reconciledAt = Date.now());
        const known = [...this.items.values()];
        const states = new Map((await docker.list(`${L}=1`)).map((c) => [c.Id, c.State]));
        for (const sandbox of known) {
          if (!this.items.has(sandbox.id) || this.chains.has(sandbox.id)) continue;
          if ((this.startedAt.get(sandbox.id) ?? 0) >= listedAt) continue;
          const state = states.get(sandbox.containerId);
          if (state === undefined) {
            this.items.delete(sandbox.id);
            this.startedAt.delete(sandbox.id);
          } else if (sandbox.state === 'running' && state !== 'running') {
            if (sandbox.onTimeout === 'kill') {
              void this.kill(sandbox.id).catch(() => undefined);
            } else {
              sandbox.state = 'paused';
              sandbox.pausedAt = Date.now();
            }
          }
        }
      }
    } catch (e) {
      // An engine hiccup skips this reconcile; unhandled, it would take lite (and an embedded engine) down.
      console.error(JSON.stringify({ level: 'error', msg: 'reconcile failed', error: String(e) }));
    } finally {
      this.sweeping = false;
    }
  }
}

export const sandboxes = new Sandboxes();
