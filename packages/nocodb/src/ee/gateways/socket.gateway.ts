import { Inject, Injectable } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import type { OnModuleInit } from '@nestjs/common';
import type { NcSocket } from '~/interface/config';
import NocoSocket from '~/socket/NocoSocket';
import { JwtStrategy } from '~/strategies/jwt.strategy';

const url = new URL(
  process.env.NC_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || '8080'}/`,
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
  constructor(
    private jwtStrategy: JwtStrategy,
    @Inject(HttpAdapterHost) private httpAdapterHost: HttpAdapterHost,
  ) {}

  @WebSocketServer()
  server: Server;

  async onModuleInit() {
    // Pass server instance to NocoSocket for room broadcasting
    NocoSocket.ioServer = this.server;

    this.server
      .use(async (socket, next) => {
        try {
          const context = new ExecutionContextHost([socket.handshake]);
          const req = context.switchToHttp().getRequest();

          // we pass empty context to authenticate, authorization will be handled per subscription request
          req.context = {};

          const guard = new (AuthGuard('jwt'))(context);
          await guard.canActivate(context);
        } catch (e) {}

        next();
      })
      .on('connection', (socket: NcSocket) => {
        NocoSocket.handleConnection(socket);
      });
  }

  public get io() {
    return this.server;
  }
}
