import crypto from 'crypto';
import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { T } from 'nc-help';
import { Server } from 'socket.io';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import Noco from '../Noco';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { TelemetryService } from './telemetry.service';
import type { OnModuleInit } from '@nestjs/common';
import type { Socket } from 'socket.io';

function getHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
})
@Injectable()
export class SocketService implements OnModuleInit {
  // private server: HttpServer;
  private clients: { [id: string]: Socket } = {};
  private _jobs: { [id: string]: { last_message: any } } = {};
  @WebSocketServer()
  private _io: Server;

  constructor(
    private readonly jwtStrategy: JwtStrategy,
    @Inject(HttpAdapterHost)
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly telemetryService: TelemetryService,
  ) {}

  async onModuleInit() {
    // this._io = new Server(
    //   Noco.httpServer ?? this.httpAdapterHost.httpAdapter.getHttpServer(),
    //   {
    //     cors: {
    //       origin: '*',
    //       allowedHeaders: ['xc-auth'],
    //       credentials: true,
    //     },
    //   },
    // );
    this.io
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
        socket.on('subscribe', (room) => {
          if (room in this.jobs) {
            socket.join(room);
            socket.emit('job');
            socket.emit('progress', this.jobs[room].last_message);
          }
        });
      });
  }

  public get io() {
    return this._io;
  }

  public get jobs() {
    return this._jobs;
  }
}
