import { Logger } from '@nestjs/common';
import type Source from '~/models/Source';
import {
  defaultConnectionConfig,
  defaultConnectionOptions,
} from '~/utils/nc-config';
import SqlClientFactory from '~/db/sql-client/lib/SqlClientFactory';
import { XKnex } from '~/db/CustomKnex';
import Noco from '~/Noco';
import { RedisVersionTracker } from '~/utils/RedisVersionTracker';
import { LRUMap } from '~/utils/LRUMap';

const CONNECTION_CACHE_MAX_SIZE = +(
  process.env.NC_CONNECTION_CACHE_MAX_SIZE || 500
);

export default class NcConnectionMgrv2 {
  protected static logger = new Logger('NcConnectionMgrv2');

  protected static sourceVersionTracker = new RedisVersionTracker(
    'SOURCE_CONN_VER',
  );

  protected static connectionRefs = new LRUMap<XKnex>(
    CONNECTION_CACHE_MAX_SIZE,
    (conn) => {
      return conn.destroy().catch((e) => {
        NcConnectionMgrv2.logger.error({
          error: e,
          details: 'Error destroying evicted connection',
        });
      });
    },
  );

  public static async destroyAll() {
    await this.connectionRefs.asyncClear();
  }

  public static async deleteAwait(source: Source) {
    // todo: ignore meta bases
    await this.connectionRefs.asyncDelete(source.id);
  }

  public static async deleteConnectionRef(sourceId: string) {
    await this.connectionRefs.asyncDelete(sourceId);
  }

  /**
   * Bump the Redis version for a source so all servers invalidate
   * their cached connection on the next get(). Also sync the local
   * version so the originating server doesn't re-trigger staleness.
   */
  public static async bumpSourceVersion(sourceId: string): Promise<void> {
    await this.sourceVersionTracker.bumpAndSync(sourceId);
  }

  /**
   * Destroy local connection + bump version for cross-server invalidation.
   * Delete ref first, then bump-and-sync so that concurrent get() calls on
   * this server create a fresh connection without re-triggering staleness.
   */
  public static async resetSource(sourceId: string): Promise<void> {
    await this.deleteConnectionRef(sourceId);
    await this.sourceVersionTracker.bumpAndSync(sourceId);
  }

  /**
   * Check if a source's connection is stale (another server bumped the
   * version via resetSource). If stale, destroy the local connection.
   */
  protected static async checkSourceStaleness(sourceId: string): Promise<void> {
    await this.sourceVersionTracker.checkStaleness(sourceId, async () => {
      await this.deleteConnectionRef(sourceId);
    });
  }

  public static async get(source: Source): Promise<XKnex> {
    if (source.isMeta()) return Noco.ncMeta.knex;

    // Cross-server staleness check via Redis version key
    await this.checkSourceStaleness(source.id);

    const cached = this.connectionRefs.get(source.id);
    if (cached) {
      return cached;
    }

    const connectionConfig = await source.getConnectionConfig();

    const knex = XKnex({
      ...defaultConnectionOptions,
      ...connectionConfig,
      connection: {
        ...defaultConnectionConfig,
        ...connectionConfig.connection,
        typeCast(field, next) {
          const res = next();

          // mysql - convert all other buffer values to hex string
          // if `bit` datatype then convert it to integer number
          if (res && res instanceof Buffer) {
            const hex = [...res]
              .map((v) => ('00' + v.toString(16)).slice(-2))
              .join('');
            if (field.type == 'BIT') {
              return parseInt(hex, 16);
            }
            return hex;
          }

          // mysql `decimal` datatype returns value as string, convert it to float number
          if (field.type == 'NEWDECIMAL') {
            return res && parseFloat(res);
          }

          return res;
        },
      },
    } as any);

    this.connectionRefs.set(source.id, knex);
    return knex;
  }

  public static async getSqlClient(source: Source, _knex = null) {
    const knex = _knex || (await this.get(source));
    return SqlClientFactory.create({
      knex,
      ...(await source.getConnectionConfig()),
    });
  }

  public static async getDataConfig?() {
    return Noco.getConfig()?.meta?.db;
  }
}
