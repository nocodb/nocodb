import type { Server } from 'socket.io';
import type { EventType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';

interface BroadcastData {
  event: EventType;
  payload: Record<string, any>;
  scopes?: string[];
}

export default class NocoSocket {
  public static ioServer: Server | null = null;

  public static handleConnection(..._args: unknown[]) {}

  public static broadcastEvent(
    context: NcContext,
    data: BroadcastData,
    excludeSocketId?: string,
  ) {
    if (!this.ioServer) return;

    const { event, payload, scopes } = data;
    const workspaceId = context.workspace_id;
    const baseId = context.base_id;

    if (scopes?.length) {
      for (const scope of scopes) {
        const channel = `${event}:${workspaceId}:${baseId}:${scope}`;
        if (excludeSocketId) {
          this.ioServer.except(excludeSocketId).emit(channel, payload);
        } else {
          this.ioServer.emit(channel, payload);
        }
      }
    } else {
      const channel = `${event}:${workspaceId}:${baseId}`;
      if (excludeSocketId) {
        this.ioServer.except(excludeSocketId).emit(channel, payload);
      } else {
        this.ioServer.emit(channel, payload);
      }
    }
  }

  public static broadcastEventToBaseUsers(
    context: NcContext,
    data: BroadcastData,
    excludeSocketId?: string,
  ) {
    if (!this.ioServer) return;

    const { event, payload } = data;
    const channel = `${event}:${context.workspace_id}:${context.base_id}`;
    if (excludeSocketId) {
      this.ioServer.except(excludeSocketId).emit(channel, payload);
    } else {
      this.ioServer.emit(channel, payload);
    }
  }

  public static broadcastEventToWorkspaceUsers(
    context: NcContext,
    data: BroadcastData,
    excludeSocketId?: string,
  ) {
    if (!this.ioServer) return;

    const { event, payload } = data;
    const channel = `${event}:${context.workspace_id}`;
    if (excludeSocketId) {
      this.ioServer.except(excludeSocketId).emit(channel, payload);
    } else {
      this.ioServer.emit(channel, payload);
    }
  }

  public static broadcastEventToUser(
    userId: string,
    data: BroadcastData,
  ) {
    if (!this.ioServer) return;

    const { event, payload } = data;
    const channel = `user:${userId}:${event}`;
    this.ioServer.emit(channel, payload);
  }
}
