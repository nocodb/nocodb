/**
 * Tunnel client for E2B sandbox WebSocket proxy.
 *
 * SYNC NOTE: This file has a copy at
 * packages/noco-integrations/packages/nocodb-workflow-node/src/nodes/run-script/tunnel-client.ts
 * (without NestJS Logger). Any changes here must be mirrored there and vice versa.
 */
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
  body: string | null;
}

const ALLOWED_PATH_PREFIXES = ['/api/v1/db/data/', '/api/v2/', '/api/v3/'];

function isPathAllowed(path: string): boolean {
  const normalized = decodeURIComponent(
    new URL(path, 'http://localhost').pathname,
  );
  return ALLOWED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export class TunnelClient {
  private ws: WebSocket | null = null;
  private logger = new Logger(TunnelClient.name);

  constructor(
    private wsUrl: string,
    private authToken: string,
    private localBaseUrl: string,
  ) {}

  static async waitForServer(healthUrl: string): Promise<void> {
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
      `Tunnel server not ready after ${
        (HEALTH_CHECK_INTERVAL_MS * HEALTH_CHECK_MAX_RETRIES) / 1000
      }s`,
    );
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Tunnel connection timed out'));
      }, REQUEST_TIMEOUT_MS);

      ws.on('message', (data: WebSocket.Data) => {
        let msg: { type: string };
        try {
          msg = JSON.parse(data.toString());
        } catch {
          clearTimeout(timeout);
          reject(new Error('Invalid handshake message from tunnel server'));
          return;
        }

        if (msg.type === 'connected') {
          clearTimeout(timeout);
          this.ws = ws;
          this.logger.log('Tunnel established');
          ws.removeAllListeners('message');
          ws.on('message', (d: WebSocket.Data) => this.onMessage(d));
          resolve();
          return;
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on('close', () => {
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
    } catch {
      // ignore parse errors
    }
  }

  private async handleRequest(req: TunnelRequest) {
    try {
      const pathOnly = req.path.split('?')[0];
      if (!isPathAllowed(pathOnly)) {
        this.sendResponse(req.id, 403, 'Forbidden', {
          error: 'Path not allowed',
        });
        return;
      }

      const url = `${this.localBaseUrl}${req.path}`;

      const headers: Record<string, string> = {};
      const safeHeaders = ['content-type', 'accept', 'content-length'];
      for (const key of safeHeaders) {
        if (req.headers[key]) {
          headers[key] = req.headers[key];
        }
      }
      headers['xc-auth'] = this.authToken;

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

      const responseBuffer = await response.arrayBuffer();
      const bodyBase64 =
        responseBuffer.byteLength > 0
          ? Buffer.from(responseBuffer).toString('base64')
          : null;

      const responseHeaders: Record<string, string> = {};
      const sensitiveHeaders = new Set(['set-cookie', 'xc-auth']);
      response.headers.forEach((value, key) => {
        if (!sensitiveHeaders.has(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      this.ws?.send(
        JSON.stringify({
          id: req.id,
          type: 'response',
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: bodyBase64,
        }),
      );
    } catch {
      this.sendResponse(req.id, 502, 'Bad Gateway', {
        error: 'Request failed',
      });
    }
  }

  private sendResponse(
    id: string,
    status: number,
    statusText: string,
    body: Record<string, string>,
  ) {
    this.ws?.send(
      JSON.stringify({
        id,
        type: 'response',
        status,
        statusText,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      }),
    );
  }
}
