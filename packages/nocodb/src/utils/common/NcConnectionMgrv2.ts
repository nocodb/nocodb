import { Logger } from '@nestjs/common';
import { OperationSource } from 'nocodb-sdk';
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
import { applyDbSsrfProtection } from '~/helpers/dbSsrfLookup';
import { isSsrfProtectionEnabled } from '~/utils/ssrf';

const CONNECTION_CACHE_MAX_SIZE = +(
  process.env.NC_CONNECTION_CACHE_MAX_SIZE || 500
);

export type SourceIdentity = Pick<Source, 'id' | 'base_id'>;

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

  /**
   * Source ids are unique per base, not instance-wide — the sources table's PK
   * is `(base_id, id)`. Keying live connections on the bare id let a source in
   * one base be served another base's cached connection.
   */
  protected static connectionKey(source: SourceIdentity): string {
    return `${source.base_id}:${source.id}`;
  }

  public static async destroyAll() {
    await this.connectionRefs.asyncClear();
  }

  public static async deleteAwait(source: SourceIdentity) {
    // todo: ignore meta bases
    await this.deleteConnectionRef(source);
  }

  public static async deleteConnectionRef(source: SourceIdentity) {
    await this.connectionRefs.asyncDelete(this.connectionKey(source));
  }

  /**
   * Bump the Redis version for a source so all servers invalidate
   * their cached connection on the next get(). Also sync the local
   * version so the originating server doesn't re-trigger staleness.
   */
  public static async bumpSourceVersion(source: SourceIdentity): Promise<void> {
    await this.sourceVersionTracker.bumpAndSync(this.connectionKey(source));
  }

  /**
   * Destroy local connection + bump version for cross-server invalidation.
   * Delete ref first, then bump-and-sync so that concurrent get() calls on
   * this server create a fresh connection without re-triggering staleness.
   */
  public static async resetSource(source: SourceIdentity): Promise<void> {
    await this.deleteConnectionRef(source);
    await this.sourceVersionTracker.bumpAndSync(this.connectionKey(source));
  }

  /**
   * Check if a source's connection is stale (another server bumped the
   * version via resetSource). If stale, destroy the local connection.
   */
  protected static async checkSourceStaleness(
    source: SourceIdentity,
  ): Promise<void> {
    await this.sourceVersionTracker.checkStaleness(
      this.connectionKey(source),
      async () => {
        await this.deleteConnectionRef(source);
      },
    );
  }

  /**
   * Cache the data source's major version on the knex client config so
   * dialect-aware code paths (e.g. MSSQL formula compilation) can read it
   * via `~/db/util/dbVersion.getDbMajor` without an extra round-trip.
   *
   * Source of truth: `source.meta.dbVersion` — populated for every dialect
   * by `populateMeta` via `SqlClient.version()`. The first dot-separated
   * component is always the major.
   */
  protected static stashDbMajorVersion(knex: XKnex, source: Source) {
    if (!knex?.client?.config) return;
    const meta = source.meta;
    let dbVersion: string | undefined;
    if (meta && typeof meta === 'object') {
      dbVersion = (meta as any).dbVersion;
    } else if (typeof meta === 'string') {
      try {
        dbVersion = JSON.parse(meta)?.dbVersion;
      } catch {
        // ignore — fall through to lazy detection
      }
    }
    if (!dbVersion) return;
    const major = parseInt(String(dbVersion).split('.')[0], 10);
    if (Number.isFinite(major) && major > 0) {
      (knex.client.config as any).nocoDbMajorVersion = major;
    }
  }

  public static async get(source: Source): Promise<XKnex> {
    if (source.isMeta()) return Noco.ncMeta.knex;

    // Cross-server staleness check via Redis version key
    await this.checkSourceStaleness(source);

    const cached = this.connectionRefs.get(this.connectionKey(source));
    if (cached) {
      return cached;
    }

    const connectionConfig = await source.getConnectionConfig();

    const knexConfig = {
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
    } as any;

    // SSRF: external user-supplied source only. Meta/internal connections
    // return earlier (source.isMeta) and never reach here.
    applyDbSsrfProtection(
      knexConfig,
      isSsrfProtectionEnabled({ source: OperationSource.EXTERNAL_DBS }),
    );

    const knex = XKnex(knexConfig);

    this.stashDbMajorVersion(knex, source);
    this.connectionRefs.set(this.connectionKey(source), knex);
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
