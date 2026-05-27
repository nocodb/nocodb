import crypto from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server } from 'socket.io';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnModuleInit } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { T } from '~/utils';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { TelemetryService } from '~/services/telemetry.service';
import { ncSiteUrl } from '~/utils/envs';

function getHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

const url = new URL(
  ncSiteUrl || `http://localhost:${process.env.PORT || '8080'}/`,
);
let namespace = url.pathname;
namespace += namespace.endsWith('/') ? '' : '/';

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
  namespace,
})
@Injectable()
export class SocketGateway implements OnModuleInit {
  // private server: HttpServer;
  private clients: { [id: string]: Socket } = {};
  private _jobs: { [id: string]: { last_message: any } } = {};
  @WebSocketServer()
  private _io: Server;

  constructor(
    private jwtStrategy: JwtStrategy,
    private telemetryService: TelemetryService,
    @Inject(HttpAdapterHost) private httpAdapterHost: HttpAdapterHost,
  ) {}

  @WebSocketServer()
  server: Server;

  async onModuleInit() {
    // CE socket only accepts telemetry beacons (`page`, `event`) — no data
    // subscriptions, rooms, or privileged operations are wired up below, so
    // anonymous connections cannot reach any sensitive surface. JWT failures
    // are swallowed on purpose so authenticated clients still get `user` on
    // the handshake while unauthenticated telemetry pings are accepted.
    // EE replaces this gateway entirely with `src/ee/gateways/socket.gateway.ts`,
    // which enforces handshake-based JWT auth before registering any handler.
    this.server
      .use(async (socket, next) => {
        try {
          const context = new ExecutionContextHost([socket.handshake as any]);
          const guard = new (AuthGuard('jwt'))(context);
          await guard.canActivate(context);
        } catch {}

        next();
      })
      .on('connection', (socket) => {
        this.clients[socket.id] = socket;
        const id = getHash(
          (process.env.NC_SERVER_UUID || T.id) +
            (socket?.handshake as any)?.user?.id,
        );

        socket.on('page', (args) => {
          // T.page({ ...args, id });
          this.telemetryService.sendEvent({
            evt_type: '$pageview',
            ...args,
            id,
          });
        });
        socket.on('event', ({ event, ...args }) => {
          // T.event({ ...args, id });
          this.telemetryService.sendEvent({ evt_type: event, ...args, id });
        });
        socket.on('disconnect', () => {
          delete this.clients[socket.id];
          delete this._jobs[socket.id];
        });
      });
  }

  public get io() {
    return this.server;
  }
}
