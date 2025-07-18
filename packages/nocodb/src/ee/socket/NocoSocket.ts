import { Logger } from '@nestjs/common';
import { EventType, type PayloadForEvent, ProjectRoles } from 'nocodb-sdk';
import { sendConnectionError, sendWelcomeMessage } from './genericEvents';
import type { NcContext, NcSocket } from '~/interface/config';
import { User } from '~/models';

interface EventSubscription {
  id: string;
  clients: {
    id: string;
    role?: string;
  }[];
}

export default class NocoSocket {
  private static logger: Logger = new Logger(NocoSocket.name);
  private static clients: Map<string, NcSocket> = new Map();
  private static subscriptions: Map<string, EventSubscription> = new Map();

  public static handleConnection(socket: NcSocket) {
    this.clients.set(socket.id, socket);
    this.logger.log(
      `Client connected: ${socket.id} (User: ${socket.handshake.user?.id})`,
    );

    // Send welcome message with proper payload
    sendWelcomeMessage(socket);

    // Set up event handlers for this client
    this.setupClientEventHandlers(socket);
  }

  public static handleDisconnection(socket: NcSocket) {
    const client = this.clients.get(socket.id);
    if (client) {
      this.clients.delete(socket.id);
      this.logger.log(
        `Client disconnected: ${socket.id} (User: ${socket.handshake.user?.id})`,
      );
    }
  }

  private static async subscribeEvent(socket: NcSocket, event: string) {
    const eventHelper = event.split(':');
    if (eventHelper.length < 3) {
      this.logger.warn(`Invalid event format: ${event}`);
      return;
    }

    const user = socket.handshake.user;
    if (!user || !user.id) {
      this.logger.warn(`User not authenticated for event: ${event}`);
      return;
    }

    const eventType = eventHelper[0];
    const workspaceId = eventHelper[1];
    const baseId = eventHelper[2];

    const userWithRole = await User.getWithRoles(
      {
        workspace_id: workspaceId,
        base_id: baseId,
      },
      user.id,
      {
        user,
        workspaceId,
        baseId,
      },
    );

    if (
      eventType === EventType.DATA_EVENT &&
      userWithRole.base_roles?.[ProjectRoles.NO_ACCESS]
    ) {
      this.logger.warn(
        `User ${user.id} has no access to base ${baseId} in workspace ${workspaceId}`,
      );
      return;
    }

    const subscription = this.subscriptions.get(event);
    if (subscription) {
      subscription.clients.push({
        id: socket.id,
        role: userWithRole.base_roles,
      });
    } else {
      this.subscriptions.set(event, {
        id: event,
        clients: [{ id: socket.id, role: userWithRole.base_roles }],
      });
    }
  }

  public static broadcastDataEvent(
    context: NcContext,
    tableId: string,
    args: Omit<PayloadForEvent<EventType.DATA_EVENT>, 'timestamp' | 'socketId'>,
    socketId?: string,
  ) {
    const event = `${EventType.DATA_EVENT}:${context.workspace_id}:${context.base_id}:${tableId}`;
    const subscription = this.subscriptions.get(event);
    const payload = {
      ...args,
      timestamp: Date.now(),
      socketId,
    };

    if (subscription) {
      subscription.clients.forEach((client) => {
        const socket = this.clients.get(client.id);
        if (socket) {
          socket.emit(event, payload);
        }
      });
    } else {
      this.logger.warn(`No subscribers for event: ${event}`);
    }
  }

  private static setupClientEventHandlers(socket: NcSocket) {
    // Room management
    /* socket.on('room:join', (data: { roomId: string; roomType: string }) => {
      this.joinRoom(socket.id, data.roomId, data.roomType);
    }); */

    socket.on('event:subscribe', (event: string) => {
      this.subscribeEvent(socket, event);
    });

    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
        serverTimestamp: new Date().toISOString(),
        latency: 0, // Could be calculated if needed
      });
    });

    // Error handling
    socket.on('error', (error: Error) => {
      this.logger.error(`Socket error from ${socket.id}:`, error);
      sendConnectionError(socket, error, 'SOCKET_ERROR');
    });

    // Handle connection errors
    socket.on('disconnect', (reason: string) => {
      this.logger.log(`Client ${socket.id} disconnected: ${reason}`);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect
        sendConnectionError(
          socket,
          new Error('Server initiated disconnect'),
          'SERVER_DISCONNECT',
        );
      }
    });
  }
}
