const int = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer, got '${raw}'`);
  return parsed;
};

const apiKey = process.env.NC_COMPUTE_LITE_KEY ?? '';
if (apiKey.length < 32) throw new Error('NC_COMPUTE_LITE_KEY must be set, 32 characters or more');

/** The code server images run (E2B code-interpreter's): the API's code route proxies to it, the port proxy never does. */
export const CODE_PORT = 49999;

export const config = {
  apiKey,
  apiPort: int('NC_COMPUTE_LITE_PORT', 8430),
  proxyPort: int('NC_COMPUTE_LITE_PROXY_PORT', 8431),
  /** The Docker engine: lite's own (embedded) or the host's, mounted in. */
  dockerSocket: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
  /** `host` shares the engine with other containers, so lite touches only its own. */
  dockerMode: (process.env.NC_COMPUTE_LITE_DOCKER === 'host' ? 'host' : 'embedded') as 'host' | 'embedded',
  maxSandboxes: int('NC_COMPUTE_LITE_MAX_SANDBOXES', 50),
  /** A paused sandbox is deleted after this long. */
  pausedRetentionMs: int('NC_COMPUTE_LITE_PAUSED_RETENTION_HOURS', 24 * 7) * 3600_000,
  /** Sandbox networks: one with internet, one without. */
  network: 'nc-compute-lite',
  internalNetwork: 'nc-compute-lite-internal',
  label: 'nc-compute-lite',
};
