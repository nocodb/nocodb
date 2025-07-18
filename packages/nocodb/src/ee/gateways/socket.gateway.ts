import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnModuleInit } from '@nestjs/common';
import type { NcSocket } from '~/interface/config';
import NocoSocket from '~/socket/NocoSocket';

const url = new URL(
  process.env.NC_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || '8080'}/`,
);
let namespace = url.pathname;
namespace += namespace.endsWith('/') ? '' : '/';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace,
})
@Injectable()
export class SocketGateway implements OnModuleInit {
  constructor() {}

  @WebSocketServer()
  server: Server;

  async onModuleInit() {
    // Pass server instance to NocoSocket for room broadcasting
    NocoSocket.ioServer = this.server;

    this.server.on('connection', (socket: NcSocket) => {
      NocoSocket.handleConnection(socket);
    });
  }

  public get io() {
    return this.server;
  }
}
