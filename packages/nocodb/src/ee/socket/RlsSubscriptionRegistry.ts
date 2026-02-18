import crypto from 'crypto';
import { Logger } from '@nestjs/common';
import type { FilterType } from 'nocodb-sdk';
import type { ColumnType } from 'nocodb-sdk';

export interface RlsAccessGroup {
  /** The resolved (concrete) filters for this access group — dynamic placeholders already substituted */
  resolvedFilters: FilterType[];
  /** Column metadata needed for in-memory row evaluation */
  columns: ColumnType[];
  /** Database client type (e.g., 'pg', 'mysql2', 'sqlite3') for filter evaluation */
  client: string;
  /** Number of sockets currently in this access group */
  refCount: number;
}

export interface RlsSocketRegistration {
  /** tableId → accessHash for each table this socket has RLS subscriptions on */
  tables: Map<string, string>;
}

/**
 * In-memory registry tracking active RLS access-groups per table.
 *
 * When a user subscribes to a table's DATA_EVENT and the table has RLS policies,
 * the server resolves their effective filters (with dynamic placeholders substituted)
 * and computes a deterministic hash. Users with identical resolved filters share
 * an access group (and Socket.IO room).
 *
 * At broadcast time, the registry provides all active access groups for a table
 * so the broadcaster can evaluate the changed row against each group's filters
 * and emit only to matching rooms.
 */
export class RlsSubscriptionRegistry {
  private static logger = new Logger(RlsSubscriptionRegistry.name);

  /** tableId → Map<accessHash, AccessGroup> */
  private static groups: Map<string, Map<string, RlsAccessGroup>> = new Map();

  /** socketId → RlsSocketRegistration */
  private static sockets: Map<string, RlsSocketRegistration> = new Map();

  /**
   * Register a socket into an access group for a table.
   * Returns the access hash (used as the room suffix).
   */
  static register(
    socketId: string,
    tableId: string,
    accessHash: string,
    resolvedFilters: FilterType[],
    columns: ColumnType[],
    client: string = 'pg',
  ): void {
    // Update groups
    let tableGroups = this.groups.get(tableId);
    if (!tableGroups) {
      tableGroups = new Map();
      this.groups.set(tableId, tableGroups);
    }

    const existing = tableGroups.get(accessHash);
    if (existing) {
      existing.refCount++;
    } else {
      tableGroups.set(accessHash, {
        resolvedFilters,
        columns,
        client,
        refCount: 1,
      });
    }

    // Track socket → table mapping
    let socketReg = this.sockets.get(socketId);
    if (!socketReg) {
      socketReg = { tables: new Map() };
      this.sockets.set(socketId, socketReg);
    }
    socketReg.tables.set(tableId, accessHash);

    this.logger.debug(
      `Registered socket ${socketId} in group ${accessHash} for table ${tableId} (refCount: ${
        tableGroups.get(accessHash)?.refCount
      })`,
    );
  }

  /**
   * Unregister a socket from its access group for a specific table.
   */
  static unregisterTable(socketId: string, tableId: string): void {
    const socketReg = this.sockets.get(socketId);
    if (!socketReg) return;

    const accessHash = socketReg.tables.get(tableId);
    if (!accessHash) return;

    socketReg.tables.delete(tableId);
    if (socketReg.tables.size === 0) {
      this.sockets.delete(socketId);
    }

    const tableGroups = this.groups.get(tableId);
    if (!tableGroups) return;

    const group = tableGroups.get(accessHash);
    if (group) {
      group.refCount--;
      if (group.refCount <= 0) {
        tableGroups.delete(accessHash);
        this.logger.debug(
          `Removed access group ${accessHash} for table ${tableId} (no more subscribers)`,
        );
      }
    }

    if (tableGroups.size === 0) {
      this.groups.delete(tableId);
    }
  }

  /**
   * Unregister a socket from ALL tables (called on disconnect).
   */
  static unregisterSocket(socketId: string): void {
    const socketReg = this.sockets.get(socketId);
    if (!socketReg) return;

    for (const tableId of socketReg.tables.keys()) {
      this.unregisterTable(socketId, tableId);
    }

    this.sockets.delete(socketId);
  }

  /**
   * Get all active access groups for a table.
   * Used at broadcast time to iterate and evaluate each group's filters.
   */
  static getGroups(tableId: string): Map<string, RlsAccessGroup> | undefined {
    return this.groups.get(tableId);
  }

  /**
   * Check if a table has any active RLS subscriptions.
   */
  static hasGroups(tableId: string): boolean {
    const g = this.groups.get(tableId);
    return !!g && g.size > 0;
  }

  /**
   * Get all socket IDs subscribed to a specific table via RLS.
   */
  static getSocketIdsForTable(tableId: string): string[] {
    const socketIds: string[] = [];
    for (const [socketId, reg] of this.sockets) {
      if (reg.tables.has(tableId)) {
        socketIds.push(socketId);
      }
    }
    return socketIds;
  }

  /**
   * Invalidate all access groups for a table.
   * Called when RLS policies change — forces re-subscribe for affected sockets.
   * Returns the list of socket IDs that need re-subscription.
   */
  static invalidateTable(tableId: string): string[] {
    const affectedSocketIds = this.getSocketIdsForTable(tableId);

    // Clean up all groups for this table
    this.groups.delete(tableId);

    // Clean up socket registrations for this table
    for (const socketId of affectedSocketIds) {
      const socketReg = this.sockets.get(socketId);
      if (socketReg) {
        socketReg.tables.delete(tableId);
        if (socketReg.tables.size === 0) {
          this.sockets.delete(socketId);
        }
      }
    }

    this.logger.debug(
      `Invalidated table ${tableId}, ${affectedSocketIds.length} sockets need re-subscribe`,
    );

    return affectedSocketIds;
  }

  /**
   * Compute a deterministic hash for a set of resolved filters.
   * Users with the same resolved filters get the same hash → same room.
   */
  static computeAccessHash(resolvedFilters: FilterType[]): string {
    if (!resolvedFilters.length) {
      return 'all'; // No filters = see all rows
    }

    // Serialize filters deterministically
    const serialized = JSON.stringify(
      resolvedFilters.map((f) => ({
        fk_column_id: f.fk_column_id,
        comparison_op: f.comparison_op,
        comparison_sub_op: f.comparison_sub_op,
        value: f.value,
        logical_op: f.logical_op,
        is_group: f.is_group,
        children: f.children,
      })),
    );

    return crypto
      .createHash('sha256')
      .update(serialized)
      .digest('hex')
      .slice(0, 12);
  }
}
