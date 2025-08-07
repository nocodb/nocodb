import { Logger } from '@nestjs/common';
import {
  EventType,
  extractRolesObj,
  type PayloadForEvent,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { sendConnectionError, sendWelcomeMessage } from './genericEvents';
import type { Server } from 'socket.io';
import type { NcContext, NcSocket } from '~/interface/config';
import type { Prettify } from '~/types/utils';
import { verifyJwt } from '~/services/users/helpers';
import { BaseUser, User, WorkspaceUser } from '~/models';
import Noco from '~/Noco';
import { getProjectRolePower } from 'src/utils/roleHelper';
import { getWorkspaceRolePower } from '../utils/roleHelper';

export default class NocoSocket {
  private static logger: Logger = new Logger(NocoSocket.name);
  private static clients: Map<string, NcSocket> = new Map();
  public static ioServer: Server | undefined;

  public static handleConnection(socket: NcSocket) {
    this.clients.set(socket.id, socket);
    this.logger.debug(`Client connected: ${socket.id}`);

    socket.once('handshake', async (args, callback) => {
      if (callback && typeof callback === 'function') {
        try {
          socket.user = verifyJwt(args?.token, Noco.getConfig()); // Attach user to socket handshake
          sendWelcomeMessage(socket);

          // join for user-specific events
          socket.join(`user:${socket.user.id}`);

          // Set up event handlers for this client
          this.setupClientEventHandlers(socket);
        } catch (e) {
          this.logger.error(e);
          sendConnectionError(
            socket,
            new Error('Authentication failed'),
            'AUTH_ERROR',
          );
          return;
        }
        // Validate and process handshake args if needed
        callback({ status: 'ok' });
      }
    });
  }

  private static async subscribeEvent(socket: NcSocket, event: string) {
    try {
      const eventHelper = event.split(':');
      if (eventHelper.length < 2) {
        this.logger.warn(`Invalid event format: ${event}`);
        return;
      }

      const user = socket.user;
      if (!user || !user.id) {
        this.logger.warn(`User not authenticated for event: ${event}`);
        return;
      }

      const eventType = eventHelper[0];
      const workspaceId = eventHelper[1];
      // Base ID is optional, if not provided, it will be undefined
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

      // Check permissions based on event type
      if (
        [
          EventType.DATA_EVENT,
          EventType.DASHBOARD_EVENT,
          EventType.WIDGET_EVENT,
          EventType.SCRIPT_EVENT,
        ].includes(eventType as EventType) &&
        userWithRole.base_roles?.[ProjectRoles.NO_ACCESS]
      ) {
        this.logger.warn(
          `User ${user.id} has no access to base ${baseId} in workspace ${workspaceId}`,
        );
        return;
      }

      // Use native Socket.IO rooms
      socket.join(event);
      this.logger.debug(`Socket ${socket.id} joined room ${event}`);
    } catch (error) {
      this.logger.error(`Error subscribing to event ${event}:`, error);
      sendConnectionError(socket, error, 'SUBSCRIBE_ERROR');
    }
  }

  public static broadcastEvent<T extends EventType>(
    context: NcContext,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
      scopes?: string[];
    },
    socketId?: string,
  ) {
    try {
      const { event, payload, scopes = [] } = params;

      const eventKey = `${event}:${context.workspace_id}:${context.base_id}${
        scopes.length > 0 ? `:${scopes.join(':')}` : ''
      }`;

      const finalPayload = {
        ...payload,
        event,
        timestamp: Date.now(),
        socketId,
      };

      if (this.ioServer) {
        this.ioServer.to(eventKey).emit(eventKey, finalPayload);
      } else {
        this.logger.warn(`No server instance available for event: ${eventKey}`);
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event ${params.event}`);
      this.logger.error(error);
    }
  }

  public static broadcastEventToUser<T extends EventType>(
    userId: string,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
    },
    socketId?: string,
  ) {
    try {
      const { event, payload } = params;

      const eventKey = `user:${userId}`;

      const finalPayload = {
        ...payload,
        event,
        timestamp: Date.now(),
        socketId,
      };

      if (this.ioServer) {
        this.ioServer.to(eventKey).emit(eventKey, finalPayload);
      } else {
        this.logger.warn(`No server instance available for event: ${eventKey}`);
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event to user ${userId}`);
      this.logger.error(error);
    }
  }

  public static async broadcastEventToWorkspaceUsers<T extends EventType>(
    context: NcContext,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
    },
    socketId?: string,
    minimumRole = WorkspaceUserRoles.VIEWER,
  ) {
    try {
      const users = await WorkspaceUser.userList({
        fk_workspace_id: context.workspace_id,
      });

      Object.assign(params.payload, {
        workspaceId: context.workspace_id,
      });

      for (const user of users) {
        if (
          getWorkspaceRolePower({
            workspace_roles: extractRolesObj(user.roles),
          }) >=
          getWorkspaceRolePower({
            workspace_roles: extractRolesObj(minimumRole),
          })
        ) {
          this.broadcastEventToUser(user.id, params, socketId);
        }
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event to workspace users`);
      this.logger.error(error);
    }
  }

  public static async broadcastEventToBaseUsers<T extends EventType>(
    context: NcContext,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
    },
    socketId?: string,
    minimumRole = ProjectRoles.VIEWER,
  ) {
    try {
      const users = await BaseUser.getUsersList(context, {
        base_id: context.base_id,
      });

      Object.assign(params.payload, {
        baseId: context.base_id,
        workspaceId: context.workspace_id,
      });

      for (const user of users) {
        const userRole =
          user.roles ??
          WorkspaceRolesToProjectRoles[user.workspace_roles] ??
          ProjectRoles.NO_ACCESS;
        if (
          getProjectRolePower({ base_roles: extractRolesObj(userRole) }) >=
          getProjectRolePower({ base_roles: extractRolesObj(minimumRole) })
        ) {
          this.broadcastEventToUser(user.id, params, socketId);
        }
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event to base users`);
      this.logger.error(error);
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
      });
    });

    // Error handling
    socket.on('error', (error: Error) => {
      this.logger.error(`Socket error from ${socket.id}: ${error}`);
      sendConnectionError(socket, error, 'SOCKET_ERROR');
    });

    // Handle connection errors
    socket.on('disconnect', (reason: string) => {
      this.logger.debug(`Client ${socket.id} disconnected: ${reason}`);
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
