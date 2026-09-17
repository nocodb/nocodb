/**
 * Reverse-tunnel client contract, shared by every sandbox tunnel.
 *
 * The backend dials INTO a sidecar running inside a sandbox, and the sidecar
 * relays each inbound request back over that socket. Every such client needs
 * the same lifetime — handshake, keepalive, reconnect with backoff, give up —
 * and differs only in what it does with a frame once it arrives.
 *
 * That lifetime lives here in {@link BaseTunnelClient}. It is deliberately free
 * of any transport: `ws`, Node Buffers and NestJS are all supplied by the
 * subclass, so this file stays importable from a browser bundle like the rest
 * of the SDK.
 */

/** Header carrying the per-turn shared secret the in-sandbox sidecars require
 *  on every HTTP request and WS upgrade — their ports are publicly reachable
 *  on the sandbox host. */
export const TUNNEL_SECRET_HEADER = 'x-nc-tunnel-secret';

/** Header carrying the provider's own traffic token, required on every request
 *  to a sandbox host created with `ingress.requireAuth`. Checked by the
 *  provider's edge, before anything in the sandbox is reached — which is why it
 *  closes sidecars we cannot rebake, unlike {@link TUNNEL_SECRET_HEADER}. */
export const TRAFFIC_TOKEN_HEADER = 'e2b-traffic-access-token';

/** Headers every call to a sandbox host must carry. */
export function sandboxHostHeaders(opts: {
  tunnelSecret?: string;
  trafficToken?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (opts.tunnelSecret) headers[TUNNEL_SECRET_HEADER] = opts.tunnelSecret;
  if (opts.trafficToken) headers[TRAFFIC_TOKEN_HEADER] = opts.trafficToken;
  return headers;
}

export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exp = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(exp, maxDelayMs);
}

export interface ReconnectConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const TUNNEL_PORT = 8585;

/** One inbound request as it arrives over the socket. `body` is base64. */
export interface TunnelRequest {
  id: string;
  type: 'request';
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
}

/** A tunnelled request, decoded, for an upstream that is not HTTP. */
export interface TunnelUpstreamRequest {
  method: string;
  path: string;
  /** JSON-parsed request body, or undefined when there was none. */
  body?: unknown;
}

export interface TunnelUpstreamResponse {
  status: number;
  body: unknown;
}

/**
 * In-process replacement for the loopback fetch. Given one, the client dispatches
 * straight to it — no self-HTTP, no credential to mint, and liveness is the
 * handler's own lifetime rather than a token TTL.
 */
export type TunnelUpstreamHandler = (
  req: TunnelUpstreamRequest
) => Promise<TunnelUpstreamResponse>;

/**
 * The raw/streaming upstream, for a tunnel relaying bytes rather than JSON —
 * headers matter, the body is unparsed, and the reply may stream (SSE).
 */
export interface TunnelStreamRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Buffer;
  signal: AbortSignal;
}

export interface TunnelStreamResponse {
  status: number;
  headers?: Record<string, string>;
  /** Full response body — for non-streaming replies. */
  body?: Buffer;
  /** Streaming reply (SSE) — chunks are relayed as they are yielded. */
  stream?: AsyncIterable<string | Uint8Array>;
}

export type TunnelStreamHandler = (
  req: TunnelStreamRequest
) => Promise<TunnelStreamResponse>;

/** Exempt from the sidecar's secret — polled before any credential exists. */
export const TUNNEL_HEALTH_PATH = '/__health';

/** Liveness probe budget: 500ms × 20 = 10s total. */
export const TUNNEL_HEALTH_CHECK_INTERVAL_MS = 500;
export const TUNNEL_HEALTH_CHECK_MAX_RETRIES = 20;

export const DEFAULT_ALLOWED_PATH_PREFIXES = [
  '/api/v1/db/data/',
  '/api/v2/',
  '/api/v3/',
];

export function isPathAllowed(path: string, prefixes: string[]): boolean {
  const normalized = decodeURIComponent(
    new URL(path, 'http://localhost').pathname
  );
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

/**
 * The internal API multiplexes every registered operation through a single
 * path, selecting on `?operation=`. A path-prefix allowlist is therefore
 * structurally incapable of scoping it: matching the prefix admits all of
 * them — token minting, webhook creation, table drops — bounded only by the
 * forwarded identity's own ACL. Anything that allows the internal prefix must
 * also name the operations it actually needs.
 */
export const INTERNAL_API_PREFIX = '/api/v2/internal/';

export function isInternalOpAllowed(
  path: string,
  allowedOps: string[]
): boolean {
  const url = new URL(path, 'http://localhost');

  if (!decodeURIComponent(url.pathname).startsWith(INTERNAL_API_PREFIX)) {
    return true;
  }

  const operation = url.searchParams.get('operation');

  // `batch` carries arbitrary sub-operations in its envelope and deliberately
  // short-circuits the envelope's own ACL check, so admitting it admits
  // everything. Never allowed, however the list is configured.
  if (!operation || operation === 'batch') return false;

  return allowedOps.includes(operation);
}

export function buildForwardHeaders(
  reqHeaders: Record<string, string>,
  opts: { injectAuth: boolean; authToken: string }
): Record<string, string> {
  // NOTE: `content-length` is intentionally NOT forwarded. We re-materialize the
  // request body from base64 downstream, so the inbound `content-length` may not
  // match the re-encoded buffer's byte length. Node's fetch (undici) honors a
  // forwarded `content-length`, and a mismatch throws
  // UND_ERR_REQ_CONTENT_LENGTH_MISMATCH (too large) or hangs until timeout (too
  // small). Let undici compute `content-length` from `body`.
  const headers: Record<string, string> = {};
  const safeHeaders = ['content-type', 'accept'];
  for (const key of safeHeaders) {
    if (reqHeaders[key]) {
      headers[key] = reqHeaders[key];
    }
  }
  if (opts.injectAuth) {
    headers['xc-auth'] = opts.authToken;
  }
  return headers;
}

/**
 * The slice of a WebSocket the lifetime actually uses. Narrow on purpose: a
 * browser `WebSocket` has no `ping`/`terminate`, so a subclass that cannot
 * ping simply reports `false` from {@link TunnelSocket.ping} and the keepalive
 * degrades to a no-op rather than throwing.
 */
export interface TunnelSocket {
  isOpen(): boolean;
  send(data: string): void;
  close(): void;
  /** Drop the connection NOW, without a closing handshake — used when a pong
   *  is missed, so 'close' fires and the reconnect path takes over. */
  terminate(): void;
  /** False when the transport has no ping frame (browsers). */
  ping(): boolean;
  onHandshakeMessage(cb: (data: string) => void): void;
  /** Replaces the handshake listener once `connected` has arrived. */
  onMessage(cb: (data: string) => void): void;
  onPong(cb: () => void): void;
  onError(cb: (err: Error) => void): void;
  onClose(cb: () => void): void;
}

export interface TunnelLogger {
  log(message: string): void;
  warn(message: string): void;
}

export interface BaseTunnelClientOptions {
  /** 0 disables the keepalive entirely. */
  keepaliveMs?: number;
  reconnect?: ReconnectConfig;
  /** Per-turn shared secret sent on the WS upgrade. */
  tunnelSecret?: string;
  /** Provider traffic token sent on the WS upgrade. */
  trafficToken?: string;
  /** Milliseconds to wait for the `connected` handshake frame. */
  handshakeTimeoutMs?: number;
}

const DEFAULT_RECONNECT: ReconnectConfig = {
  maxAttempts: 0,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

export abstract class BaseTunnelClient {
  protected socket: TunnelSocket | null = null;

  private closedByUs = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private awaitingPong = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private gaveUp = false;

  protected readonly keepaliveMs: number;
  protected readonly tunnelSecret: string;
  protected readonly trafficToken: string;
  protected readonly handshakeTimeoutMs: number;
  protected readonly reconnectCfg: ReconnectConfig;

  constructor(
    protected readonly wsUrl: string,
    opts: BaseTunnelClientOptions = {}
  ) {
    this.keepaliveMs = opts.keepaliveMs ?? 0;
    this.tunnelSecret = opts.tunnelSecret ?? '';
    this.trafficToken = opts.trafficToken ?? '';
    this.handshakeTimeoutMs = opts.handshakeTimeoutMs ?? 30_000;
    this.reconnectCfg = opts.reconnect ?? DEFAULT_RECONNECT;
  }

  /** Name used in log lines and connect errors, e.g. "LLM tunnel". */
  protected abstract readonly label: string;

  /** A plain property, not a getter — tests swap it to capture warnings. */
  protected abstract logger: TunnelLogger;

  /** Open a transport to `wsUrl` carrying `headers`. */
  protected abstract createSocket(
    url: string,
    headers: Record<string, string>
  ): TunnelSocket;

  /** A frame that arrived after the handshake. */
  protected abstract onFrame(raw: string): void;

  /** Subclass cleanup when the socket drops or the client is closed — e.g.
   *  aborting in-flight requests. Called before any reconnect is scheduled. */
  protected onDisconnected(): void {
    // nothing by default
  }

  async connect(): Promise<void> {
    this.closedByUs = false;
    await this.openSocket();
  }

  async close(): Promise<void> {
    this.closedByUs = true;
    this.stopKeepalive();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.onDisconnected();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  protected send(obj: Record<string, unknown>): void {
    if (this.socket?.isOpen()) this.socket.send(JSON.stringify(obj));
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.createSocket(
        this.wsUrl,
        sandboxHostHeaders({
          tunnelSecret: this.tunnelSecret,
          trafficToken: this.trafficToken,
        })
      );

      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error(`${this.label} connection timed out`));
      }, this.handshakeTimeoutMs);

      socket.onHandshakeMessage((raw) => {
        let msg: { type?: string };
        try {
          msg = JSON.parse(raw);
        } catch {
          clearTimeout(timeout);
          reject(new Error(`Invalid handshake message from ${this.label}`));
          return;
        }

        if (msg.type !== 'connected') return;

        clearTimeout(timeout);
        this.socket = socket;
        this.reconnectAttempts = 0;
        this.gaveUp = false;
        this.logger.log(`${this.label} established`);
        socket.onMessage((d) => this.onFrame(d));
        this.startKeepalive();
        resolve();
      });

      socket.onPong(() => {
        this.awaitingPong = false;
      });

      socket.onError((err) => {
        clearTimeout(timeout);
        reject(err);
      });

      socket.onClose(() => {
        this.socket = null;
        this.stopKeepalive();
        this.onDisconnected();
        if (!this.closedByUs) this.scheduleReconnect();
      });
    });
  }

  private startKeepalive(): void {
    if (this.keepaliveMs <= 0) return;

    this.stopKeepalive();
    this.awaitingPong = false;

    this.keepaliveTimer = setInterval(() => {
      if (!this.socket) return;

      if (this.awaitingPong) {
        // Missed the previous pong — treat the socket as dead; terminate to
        // trigger 'close' -> reconnect.
        this.awaitingPong = false;
        this.socket.terminate();
        return;
      }

      // A transport without ping frames can't detect a half-open socket this
      // way; leave awaitingPong false so it never self-terminates.
      this.awaitingPong = this.socket.ping();
    }, this.keepaliveMs);

    // Don't hold the event loop open (matters for tests + graceful shutdown).
    (this.keepaliveTimer as { unref?: () => void }).unref?.();
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUs) return;

    // A failed attempt reports twice — openSocket() rejects (via 'error') AND
    // the socket emits 'close' — so dedupe: at most one pending timer, one
    // terminal "gave up". Without this, every failure forks parallel reconnect
    // chains that burn maxAttempts twice as fast and compress the backoff.
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.reconnectCfg.maxAttempts) {
      if (this.reconnectCfg.maxAttempts > 0 && !this.gaveUp) {
        this.gaveUp = true;
        this.logger.warn(
          `${this.label} reconnect gave up after ${this.reconnectCfg.maxAttempts} attempts`
        );
      }
      return;
    }

    this.reconnectAttempts += 1;

    const delay = computeBackoffMs(
      this.reconnectAttempts,
      this.reconnectCfg.baseDelayMs,
      this.reconnectCfg.maxDelayMs
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.closedByUs) return;
      // Some connect-time rejections may not pair with a 'close' event, so
      // schedule here too — the pending-timer guard collapses the pair.
      this.openSocket().catch(() => this.scheduleReconnect());
    }, delay);

    (this.reconnectTimer as { unref?: () => void }).unref?.();
  }
}
