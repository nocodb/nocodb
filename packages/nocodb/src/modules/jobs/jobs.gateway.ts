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
import { Inject } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import type { JobStatus } from '~/interface/Jobs';
import { JobEvents } from '~/interface/Jobs';

const url = new URL(
  process.env.NC_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || '8080'}/`,
);
let namespace = url.pathname;
namespace += namespace.endsWith('/') ? 'jobs' : '/jobs';

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
  namespace,
})
export class JobsGateway implements OnModuleInit {
  constructor(@Inject('JobsService') private readonly jobsService) {}

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
    @MessageBody()
    body: { _id: number; data: { id: string } | any },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { _id, data } = body;
    if (Object.keys(data).every((k) => ['id'].includes(k)) && data?.id) {
      const rooms = (await this.jobsService.jobList()).map(
        (j) => `jobs-${j.id}`,
      );
      const room = rooms.find((r) => r === `jobs-${data.id}`);
      if (room) {
        client.join(`jobs-${data.id}`);
        client.emit('subscribed', {
          _id,
          id: data.id,
        });
      }
    } else {
      const job = await this.jobsService.getJobWithData(data);
      if (job) {
        client.join(`jobs-${job.id}`);
        client.emit('subscribed', {
          _id,
          id: job.id,
        });
      }
    }
  }

  @SubscribeMessage('status')
  async status(
    @MessageBody() body: { _id: number; data: { id: string } },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { _id, data } = body;
    client.emit('status', {
      _id,
      id: data.id,
      status: await this.jobsService.jobStatus(data.id),
    });
  }

  @OnEvent(JobEvents.STATUS)
  sendJobStatus(data: { id: string; status: JobStatus; data?: any }): void {
    this.server.to(`jobs-${data.id}`).emit('status', {
      id: data.id,
      status: data.status,
      data: data.data,
    });
  }

  @OnEvent(JobEvents.LOG)
  sendJobLog(data: { id: string; data: { message: string } }): void {
    this.server.to(`jobs-${data.id}`).emit('log', {
      id: data.id,
      data: data.data,
    });
  }
}
