import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AuthGuard } from '@nestjs/passport';
import { JobsService } from './jobs.service';
import type { OnModuleInit } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
  namespace: 'jobs',
})
@Injectable()
export class JobsGateway implements OnModuleInit {
  constructor(private readonly jobsService: JobsService) {}

  @WebSocketServer()
  server: Server;

  async onModuleInit() {
    this.server.use(async (socket, next) => {
      try {
        const context = new ExecutionContextHost([socket.handshake as any]);
        const guard = new (AuthGuard('jwt'))(context);
        await guard.canActivate(context);
      } catch {}

      next();
    });
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @MessageBody() data: { type: string; id: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const rooms = await this.jobsService.jobList(data.type);
    const room = rooms.find((r) => r.id === data.id);
    if (room) {
      client.join(data.id);
    }
  }

  @SubscribeMessage('status')
  async status(
    @MessageBody() data: { type: string; id: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    client.emit('status', {
      id: data.id,
      type: data.type,
      status: await this.jobsService.jobStatus(data.type, data.id),
    });
  }

  async jobStatus(data: {
    type: string;
    id: string;
    status:
      | 'completed'
      | 'waiting'
      | 'active'
      | 'delayed'
      | 'failed'
      | 'paused'
      | 'refresh';
  }): Promise<void> {
    this.server.to(data.id).emit('status', {
      id: data.id,
      type: data.type,
      status: data.status,
    });
  }
}
