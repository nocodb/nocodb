import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, UseGuards } from '@nestjs/common';
import { GlobalGuard } from 'src/guards/global/global.guard';
import { ExtractProjectIdMiddleware } from 'src/middlewares/extract-project-id/extract-project-id.middleware';
import { JobsService } from './jobs.service';

@WebSocketGateway(8081, {
  cors: {
    origin: '*',
  },
  allowedHeaders: ['xc-auth'],
  credentials: true,
  namespace: 'jobs',
})
@Injectable()
export class JobsGateway {
  constructor(private readonly jobsService: JobsService) {}

  @WebSocketServer()
  server: Server;

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
