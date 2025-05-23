import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OnModuleInit } from '@nestjs/common';
import { PubSubRedis } from '~/redis/pubsub-redis';
import Noco from '~/Noco';
import { SyncTables } from '~/utils/globals';

const url = new URL(
  process.env.NC_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || '8080'}/`,
);
let namespace = url.pathname;
namespace += namespace.endsWith('/') ? '' : '/';

interface MetaSubscription {
  workspace_id: string;
  base_id: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    allowedHeaders: ['xc-auth'],
    credentials: true,
  },
  namespace,
})
@Injectable()
export class RealtimeService implements OnModuleInit {
  private logger = new Logger(RealtimeService.name);
  private clients: { [id: string]: Socket } = {};
  private channelSubscriptions: Map<string, () => Promise<void>> = new Map();
  private clientSubscriptions: Map<string, MetaSubscription[]> = new Map();

  @WebSocketServer()
  private _io: Server;

  constructor() {
    Noco.realtimeService = this;
  }

  async onModuleInit() {
    this._io
      .use(async (socket, next) => {
        try {
          const context = new ExecutionContextHost([socket.handshake as any]);
          const guard = new (AuthGuard('jwt'))(context);
          await guard.canActivate(context);
        } catch (e) {
          this.logger.error('Authentication failed:', e.message);
          next(new Error('Authentication failed'));
          return;
        }
        next();
      })
      .on('connection', (socket) => {
        this.clients[socket.id] = socket;
        this.clientSubscriptions.set(socket.id, []);
        const userId = (socket?.handshake as any)?.user?.id;

        this.logger.log(`Client ${socket.id} connected (user: ${userId})`);

        socket.on('disconnect', () => this.handleDisconnect(socket));
      });
  }

  private async handleDisconnect(socket: Socket) {
    this.logger.log(`Client ${socket.id} disconnected`);
    delete this.clients[socket.id];
    this.clientSubscriptions.delete(socket.id);

    if (Object.keys(this.clients).length === 0) {
      for (const [channel, unsubscribe] of this.channelSubscriptions) {
        await unsubscribe();
        this.channelSubscriptions.delete(channel);
      }
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(socket: Socket, data: string) {
    const { workspace_id, base_id } = JSON.parse(data) as MetaSubscription;

    if (!workspace_id || !base_id) {
      throw new WsException(
        'Invalid subscription data: workspace_id and base_id are required',
      );
    }

    const channel = this.getChannelName(workspace_id, base_id);

    socket.join(channel);
    this.logger.log(`Client ${socket.id} subscribed to ${channel}`);

    const subscriptions = this.clientSubscriptions.get(socket.id) || [];
    if (
      !subscriptions.some(
        (s) => s.workspace_id === workspace_id && s.base_id === base_id,
      )
    ) {
      subscriptions.push({ workspace_id, base_id });
      this.clientSubscriptions.set(socket.id, subscriptions);
    }

    if (!this.channelSubscriptions.has(channel) && PubSubRedis.available) {
      const unsubscribe = await PubSubRedis.subscribe(
        channel,
        async (message) => {
          this._io.to(channel).emit(message.type, message.data);
        },
      );
      this.channelSubscriptions.set(channel, unsubscribe);
    }

    return { status: 'subscribed', channel };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(socket: Socket, data: string) {
    const { workspace_id, base_id } = JSON.parse(data) as MetaSubscription;
    const channel = this.getChannelName(workspace_id, base_id);

    socket.leave(channel);
    this.logger.log(`Client ${socket.id} unsubscribed from ${channel}`);

    const subscriptions = this.clientSubscriptions.get(socket.id) || [];
    const index = subscriptions.findIndex(
      (s) => s.workspace_id === workspace_id && s.base_id === base_id,
    );
    if (index > -1) {
      subscriptions.splice(index, 1);
      this.clientSubscriptions.set(socket.id, subscriptions);
    }

    const room = this._io.sockets.adapter?.rooms?.get(channel);
    if ((!room || room.size === 0) && this.channelSubscriptions.has(channel)) {
      const unsubscribe = this.channelSubscriptions.get(channel);
      await unsubscribe();
      this.channelSubscriptions.delete(channel);
    }

    return { status: 'unsubscribed', channel };
  }

  private getChannelName(workspace_id: string, base_id: string): string {
    return `META:${workspace_id}:${base_id}`;
  }

  /**
   * Emits a metadata event to subscribed clients.
   * @param event - Event object containing type, workspace_id, base_id, target, and payload.
   */
  async emit(event: {
    type: string;
    workspace_id: string;
    base_id: string;
    target: string;
    payload: any;
  }): Promise<void> {
    const channel = this.getChannelName(event.workspace_id, event.base_id);
    const message = {
      type: event.type,
      data: { target: event.target, payload: event.payload },
      timestamp: new Date().toISOString(),
    };

    if (PubSubRedis.available) {
      await PubSubRedis.publish(channel, message);
      this.logger.log(
        `Published to Redis channel ${channel}: ${JSON.stringify(message)}`,
      );
    } else {
      this._io.to(channel).emit(event.type, message.data);
      this.logger.log(
        `Broadcasted to in-memory channel ${channel}: ${JSON.stringify(
          message,
        )}`,
      );
    }
  }

  async bootstrap(context: NcContext, req: NcRequest) {
    const { workspace_id, base_id } = context;

    const results = [];

    try {
      for (const table of Object.values(SyncTables)) {
        const list = await Noco.ncMeta.metaList2(workspace_id, base_id, table);

        results.push({
          table,
          records: list,
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Bootstrap failed:', error);
      throw new Error('Bootstrap failed');
    }
  }

  /**
   * Sync events for a specific base since a certain point
   * @param workspace_id Workspace ID
   * @param base_id Base ID
   * @param since The ID or timestamp to sync from
   * @param sinceType Type of the since parameter ('event_id' or 'timestamp')
   * @param offset Pagination offset
   * @param limit Pagination limit
   * @param context NcContext
   * @param req NcRequest
   */
  async syncEvents(
    workspace_id: string,
    base_id: string,
    since: string,
    sinceType: 'event_id' | 'timestamp' = 'event_id',
    offset = 0,
    limit = 100,
    context: NcContext,
    req: NcRequest,
  ) {
    try {
      this.logger.log(
        `Syncing events for base ${base_id} since ${since} (${sinceType})`,
      );

      // Query events from the event log
      const query = Noco.ncMeta
        .knexConnection('nc_event_log')
        .where('base_id', base_id);

      // Filter based on since type
      if (sinceType === 'event_id' && since) {
        query.where('id', '>', since);
      } else if (sinceType === 'timestamp' && since) {
        query.where('created_at', '>', since);
      }

      // Apply pagination
      const events = await query
        .orderBy('id', 'asc')
        .offset(offset || 0)
        .limit(limit || 100);

      // Process events for client consumption - parse payloads
      const formattedEvents = events.map((event) => ({
        ...event,
        // Parse payload from JSON string if it's stored as a string
        payload:
          typeof event.payload === 'string'
            ? JSON.parse(event.payload)
            : event.payload,
        // Parse old_data from JSON string if it exists and is stored as a string
        old_data:
          event.old_data && typeof event.old_data === 'string'
            ? JSON.parse(event.old_data)
            : event.old_data,
      }));

      this.logger.log(`Found ${formattedEvents.length} events to sync`);

      return formattedEvents;
    } catch (error) {
      this.logger.error('Sync events failed:', error);
      throw new Error(`Failed to sync events: ${error.message}`);
    }
  }

  public get io() {
    return this._io;
  }
}
