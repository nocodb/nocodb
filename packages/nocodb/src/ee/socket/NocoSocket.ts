import { Logger } from '@nestjs/common';
import { EventType, type PayloadForEvent, ProjectRoles } from 'nocodb-sdk';
import { sendConnectionError, sendWelcomeMessage } from './genericEvents';
import type { Server } from 'socket.io';
import type { NcContext, NcSocket } from '~/interface/config';
import { User } from '~/models';

export default class NocoSocket {
  private static logger: Logger = new Logger(NocoSocket.name);
  private static clients: Map<string, NcSocket> = new Map();
  public static ioServer: Server | undefined;

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

    // Use native Socket.IO rooms
    socket.join(event);
    this.logger.log(`Socket ${socket.id} joined room ${event}`);
  }

  public static broadcastDataEvent(
    context: NcContext,
    tableId: string,
    args: Omit<PayloadForEvent<EventType.DATA_EVENT>, 'timestamp' | 'socketId'>,
    socketId?: string,
  ) {
    const event = `${EventType.DATA_EVENT}:${context.workspace_id}:${context.base_id}:${tableId}`;
    const payload = {
      ...args,
      timestamp: Date.now(),
      socketId,
    };

    // Use static ioServer reference
    if (this.ioServer) {
      this.ioServer.to(event).emit(event, payload);
    } else {
      this.logger.warn(`No server instance available for event: ${event}`);
    }
  }

  private static setupClientEventHandlers(socket: NcSocket) {
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
      this.logger.error(`Socket error from ${socket.id}: ${error}`);
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
