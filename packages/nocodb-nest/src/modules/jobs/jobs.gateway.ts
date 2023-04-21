import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
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
  constructor(
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
  ) {}

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
    @MessageBody() data: { name: string; id: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const rooms = (await this.jobsService.jobList(data.name)).map(
      (j) => `${j.name}-${j.id}`,
    );
    const room = rooms.find((r) => r === `${data.name}-${data.id}`);
    if (room) {
      client.join(`${data.name}-${data.id}`);
    }
  }

  @SubscribeMessage('status')
  async status(
    @MessageBody() data: { name: string; id: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    client.emit('status', {
      id: data.id,
      name: data.name,
      status: await this.jobsService.jobStatus(data.id),
    });
  }

  async jobStatus(data: {
    name: string;
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
    this.server.to(`${data.name}-${data.id}`).emit('status', {
      id: data.id,
      name: data.name,
      status: data.status,
    });
  }
}
