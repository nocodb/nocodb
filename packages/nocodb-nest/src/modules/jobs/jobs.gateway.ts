import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { AuthGuard } from '@nestjs/passport';
import { OnEvent } from '@nestjs/event-emitter';
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
    @MessageBody() data: { name: string; id: string } | { id: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if ('name' in data) {
      const rooms = (await this.jobsService.jobList(data.name)).map(
        (j) => `${j.name}-${j.id}`,
      );
      const room = rooms.find((r) => r === `${data.name}-${data.id}`);
      if (room) {
        client.join(`${data.name}-${data.id}`);
        client.emit('subscribed', {
          subbed: data.id,
          name: data.name,
          id: data.id,
        });
      }
    } else {
      const job = await this.jobsService.getJobWithData({ id: data.id });
      if (job) {
        client.join(`${job.name}-${job.id}`);
        client.emit('subscribed', {
          subbed: data.id,
          name: job.name,
          id: job.id,
        });
      }
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

  @OnEvent('job.status')
  async sendJobStatus(data: {
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

  @OnEvent('job.log')
  async sendJobLog(data: {
    name: string;
    id: string;
    data: { message: string };
  }): Promise<void> {
    this.server.to(`${data.name}-${data.id}`).emit('log', {
      id: data.id,
      name: data.name,
      data: data.data,
    });
  }
}
