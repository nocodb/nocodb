import crypto from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { T } from 'nc-help';
import { Server } from 'socket.io';
import { AuthGuard } from '@nestjs/passport';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import type { OnModuleInit } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

function getHash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

@Injectable()
export class ClientService implements OnModuleInit {
  // private server: HttpServer;
  private clients: { [id: string]: Socket } = {};
  private jobs: { [id: string]: { last_message: any } } = {};

  constructor(
    private jwtStrategy: JwtStrategy,
    @Inject(HttpAdapterHost) private httpAdapterHost: HttpAdapterHost,
  ) {
    // this.server = this.httpAdapterHost.httpAdapter.getHttpServer();
  }

  async onModuleInit() {
    const io = new Server(this.httpAdapterHost.httpAdapter.getHttpServer(), {
      cors: {
        origin: '*',
        allowedHeaders: ['xc-auth'],
        credentials: true,
      },
    });
    io.use(async (socket, next) => {
      // const authGuard = new (AuthGuard('jwt'))();
      // const result = await authGuard.canActivate(socket.handshake as any);
      // if (!result) {
      //   throw new UnauthorizedException();
      // }
      // return new Promise((resolve, reject) => {
      //   this.jwtStrategy.authenticate(
      //     socket.handshake as any,
      //     (error, user) => {
      //       if (error) {
      //         reject(new UnauthorizedException(error.message));
      //       } else {
      //         resolve(user);
      //       }
      //     },
      //   );
      // });
      try {
        const context = new ExecutionContextHost([socket.handshake as any]);
        const guard = new (AuthGuard('jwt'))(context);
        const canActivate = await guard.canActivate(context);
      } catch {}

      next()
    }).on('connection', (socket) => {
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
}
