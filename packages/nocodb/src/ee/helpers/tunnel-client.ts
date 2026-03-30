import { Logger } from '@nestjs/common';
import WebSocket from 'ws';

const REQUEST_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_INTERVAL_MS = 500;
const HEALTH_CHECK_MAX_RETRIES = 20; // 10 seconds total

export const TUNNEL_PORT = 8585;

interface TunnelRequest {
  id: string;
  type: 'request';
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null; // base64-encoded
}

interface TunnelResponse {
  id: string;
  type: 'response';
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | null; // base64-encoded
}

export class TunnelClient {
  private ws: WebSocket | null = null;
  private logger = new Logger(TunnelClient.name);

  constructor(
    private wsUrl: string,
    private authToken: string,
    private localBaseUrl: string,
  ) {}

  /**
   * Wait for the tunnel server inside the sandbox to be ready.
   * Polls the health endpoint via the E2B public host URL.
   */
  static async waitForServer(
    healthUrl: string,
    logger?: Logger,
  ): Promise<void> {
    for (let i = 0; i < HEALTH_CHECK_MAX_RETRIES; i++) {
      try {
        const res = await fetch(healthUrl, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) return;
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
    }
    throw new Error(
      `Tunnel server not ready after ${(HEALTH_CHECK_INTERVAL_MS * HEALTH_CHECK_MAX_RETRIES) / 1000}s`,
    );
  }

  /**
   * Opens the WebSocket connection and sends the auth handshake.
   * Resolves once the tunnel server acknowledges readiness.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Tunnel connection timed out'));
      }, REQUEST_TIMEOUT_MS);

      ws.on('open', () => {
        this.logger.log('Connected to tunnel server');
        // Send auth handshake
        ws.send(JSON.stringify({ type: 'ready', authToken: this.authToken }));
      });

      ws.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'ready_ack') {
          clearTimeout(timeout);
          this.ws = ws;
          this.logger.log('Tunnel handshake complete');
          // Switch to relay mode
          ws.removeAllListeners('message');
          ws.on('message', (d: WebSocket.Data) => this.onMessage(d));
          resolve();
          return;
        }

        if (msg.type === 'request') {
          this.handleRequest(msg as TunnelRequest);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        this.logger.error('Tunnel WebSocket error', err.message);
        reject(err);
      });

      ws.on('close', () => {
        this.logger.log('Tunnel connection closed');
        this.ws = null;
      });
    });
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private onMessage(data: WebSocket.Data) {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'request') {
        this.handleRequest(msg as TunnelRequest);
      }
    } catch (err: any) {
      this.logger.error('Failed to parse tunnel message', err.message);
    }
  }

  private async handleRequest(req: TunnelRequest) {
    try {
      const url = `${this.localBaseUrl}${req.path}`;

      // Prepare headers — inject auth token
      const headers: Record<string, string> = { ...req.headers };
      if (this.authToken) {
        headers['xc-auth'] = this.authToken;
      }

      // Decode body from base64
      let body: Buffer | undefined;
      if (req.body) {
        body = Buffer.from(req.body, 'base64');
      }

      const response = await fetch(url, {
        method: req.method,
        headers,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // Read response body as base64
      const responseBuffer = await response.arrayBuffer();
      const bodyBase64 =
        responseBuffer.byteLength > 0
          ? Buffer.from(responseBuffer).toString('base64')
          : null;

      // Collect response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const tunnelRes: TunnelResponse = {
        id: req.id,
        type: 'response',
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyBase64,
      };

      this.ws?.send(JSON.stringify(tunnelRes));
    } catch (err: any) {
      this.logger.error(
        `Failed to replay request ${req.method} ${req.path}`,
        err.message,
      );

      // Send error response back
      const tunnelRes: TunnelResponse = {
        id: req.id,
        type: 'response',
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(
          JSON.stringify({ error: err.message }),
        ).toString('base64'),
      };

      this.ws?.send(JSON.stringify(tunnelRes));
    }
  }
}
