import crypto from 'crypto';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Inject, Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { T } from 'nc-help';
import { Server } from 'socket.io';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { JwtStrategy } from '../strategies/jwt.strategy';
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
export class SocketGateway implements OnModuleInit {
  // private server: HttpServer;
  private clients: { [id: string]: Socket } = {};
  private _jobs: { [id: string]: { last_message: any } } = {};

  constructor(
    private jwtStrategy: JwtStrategy,
    @Inject(HttpAdapterHost) private httpAdapterHost: HttpAdapterHost,
  ) {}

  @WebSocketServer()
  server: Server;

  async onModuleInit() {
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
          T.page({ ...args, id });
        });
        socket.on('event', (args) => {
          T.event({ ...args, id });
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
    return this.server;
  }

  public get jobs() {
    return this._jobs;
  }
}
