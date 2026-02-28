import { Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { NcSocket } from '~/interface/config';
import { User } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

interface PresenceEntry {
  user: {
    id: string;
    email: string;
    displayName: string;
    meta?: Record<string, any> | null;
  };
  resource: {
    id?: string;
    type?: string;
    viewId?: string;
  };
  lastSeen: number;
}

const PRESENCE_ROOM_TTL_SECS = 180;
const PRESENCE_TIMEOUT_MS = 90_000;

export default class NocoPresence {
  private static readonly logger = new Logger(NocoPresence.name);

  private static readonly _fallback = new Map<
    string,
    Map<string, PresenceEntry>
  >();

  private static get useFallback(): boolean {
    return (process.env.NC_DISABLE_CACHE || 'false') === 'true';
  }

  private static presenceContext(roomKey: string): {
    workspace_id: string;
    base_id: string;
  } {
    const parts = roomKey.split(':');
    return { workspace_id: parts[1], base_id: parts[2] };
  }

  private static async upsertEntry(
    roomKey: string,
    entry: PresenceEntry,
  ): Promise<void> {
    if (this.useFallback) {
      if (!this._fallback.has(roomKey)) {
        this._fallback.set(roomKey, new Map());
      }
      this._fallback.get(roomKey)!.set(entry.user.id, entry);
      return;
    }
    const ctx = this.presenceContext(roomKey);
    await NocoCache.setHashField(
      ctx,
      CacheScope.PRESENCE,
      entry.user.id,
      JSON.stringify(entry),
    );
    await NocoCache.expireHash(
      ctx,
      CacheScope.PRESENCE,
      PRESENCE_ROOM_TTL_SECS,
    );
  }

  private static async removeEntry(
    roomKey: string,
    userId: string,
  ): Promise<void> {
    if (this.useFallback) {
      this._fallback.get(roomKey)?.delete(userId);
      if (this._fallback.get(roomKey)?.size === 0) {
        this._fallback.delete(roomKey);
      }
      return;
    }
    const ctx = this.presenceContext(roomKey);
    await NocoCache.delHashField(ctx, CacheScope.PRESENCE, userId);
  }

  private static async getEntry(
    roomKey: string,
    userId: string,
  ): Promise<PresenceEntry | null> {
    if (this.useFallback) {
      return this._fallback.get(roomKey)?.get(userId) ?? null;
    }
    const ctx = this.presenceContext(roomKey);
    const raw = await NocoCache.getHashField(ctx, CacheScope.PRESENCE, userId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PresenceEntry;
    } catch {
      return null;
    }
  }

  private static async getActiveEntries(
    roomKey: string,
  ): Promise<PresenceEntry[]> {
    const now = Date.now();

    if (this.useFallback) {
      const room = this._fallback.get(roomKey);
      if (!room) return [];
      return Array.from(room.values()).filter(
        (e) => now - e.lastSeen <= PRESENCE_TIMEOUT_MS,
      );
    }

    const ctx = this.presenceContext(roomKey);
    const hash = await NocoCache.getHash(ctx, CacheScope.PRESENCE);
    if (!hash) return [];
    return Object.values(hash)
      .map((v) => {
        try {
          return JSON.parse(v as string) as PresenceEntry;
        } catch {
          return null;
        }
      })
      .filter(
        (e): e is PresenceEntry =>
          !!e && now - e.lastSeen <= PRESENCE_TIMEOUT_MS,
      );
  }

  public static setupHandlers(socket: NcSocket): void {
    socket.on('presence:update', async (payload: any) => {
      if (!socket.user?.id) return;

      const trustedUserId = socket.user.id;
      const { action } = payload || {};
      if (!action) return;

      const roomKey: string | undefined = socket.data.presenceRoom;
      if (!roomKey) return;

      // ── Leave ──
      if (action === 'leave') {
        await this.removeEntry(roomKey, trustedUserId);
        socket.to(roomKey).emit(roomKey, {
          action: 'leave',
          user: { id: trustedUserId },
          socketId: socket.id,
          timestamp: Date.now(),
        });
        return;
      }

      // ── Heartbeat ──
      if (action === 'heartbeat') {
        const resource = payload.resource as
          | PresenceEntry['resource']
          | undefined;
        const existing = await this.getEntry(roomKey, trustedUserId);
        if (existing) {
          const locationChanged =
            (resource?.id !== undefined &&
              resource.id !== existing.resource.id) ||
            (resource?.viewId !== undefined &&
              resource.viewId !== existing.resource.viewId) ||
            (resource?.type !== undefined &&
              resource.type !== existing.resource.type);
          await this.upsertEntry(roomKey, {
            ...existing,
            lastSeen: Date.now(),
            resource: { ...existing.resource, ...resource },
          });
          if (locationChanged) {
            socket.to(roomKey).emit(roomKey, {
              action: 'location-change',
              user: { id: trustedUserId },
              resource: { ...existing.resource, ...resource },
              timestamp: Date.now(),
            });
          }
        } else {
          // Edge case: heartbeat before announce — write minimal entry
          await this.upsertEntry(roomKey, {
            user: {
              id: trustedUserId,
              email: socket.user.email,
              displayName: (socket.user as any).display_name,
              meta: null,
            },
            resource: resource ?? {},
            lastSeen: Date.now(),
          });
        }
        return;
      }

      const resource = payload.resource as
        | PresenceEntry['resource']
        | undefined;
      let trustedEmail = socket.user.email;
      let trustedDisplayName = trustedEmail;
      let trustedMeta: Record<string, any> | null = null;

      try {
        const freshUser = await User.get(trustedUserId);
        if (freshUser) {
          trustedEmail = freshUser.email || socket.user.email;
          trustedDisplayName = freshUser.display_name;
          trustedMeta = (freshUser.meta as Record<string, any>) ?? null;
        }
      } catch {
        this.logger.warn(
          `Failed to fetch user ${trustedUserId} for presence announce`,
        );
        trustedDisplayName = (socket.user as any).display_name;
      }

      const isNewUser = (await this.getEntry(roomKey, trustedUserId)) === null;

      const entry: PresenceEntry = {
        user: {
          id: trustedUserId,
          email: trustedEmail,
          displayName: trustedDisplayName,
          meta: trustedMeta,
        },
        resource: resource ?? {},
        lastSeen: Date.now(),
      };

      await this.upsertEntry(roomKey, entry);

      socket.to(roomKey).emit(roomKey, {
        action: 'announce',
        user: entry.user,
        resource: entry.resource,
        socketId: socket.id,
        timestamp: Date.now(),
      });

      if (isNewUser) {
        const others = (await this.getActiveEntries(roomKey)).filter(
          (u) => u.user.id !== trustedUserId,
        );
        socket.emit(roomKey, {
          action: 'batch',
          users: others.map((u) => ({
            user: u.user,
            resource: u.resource,
            lastSeen: u.lastSeen,
          })),
          timestamp: Date.now(),
        });
      }
    });
  }

  public static handleDisconnect(socket: NcSocket, ioServer: Server): void {
    const presenceRooms: Set<string> = socket.data.presenceRooms || new Set();
    const userId = socket.user?.id;

    for (const room of presenceRooms) {
      if (userId) {
        this.removeEntry(room, userId).catch((e) =>
          this.logger.error(
            `Failed to remove presence entry on disconnect`,
            e.stack,
          ),
        );
      }

      ioServer?.to(room).emit(room, {
        action: 'leave',
        user: { id: userId },
        socketId: socket.id,
        timestamp: Date.now(),
      });
    }
  }
}
