import SqlClientFactory from '../../db/sql-client/lib/SqlClientFactory';
import { XKnex } from '../../db/sql-data-mapper';
import {
  defaultConnectionConfig,
  defaultConnectionOptions,
} from '../NcConfigFactory';
import Base from '../../models/Base';
import Noco from '../../Noco';

export default class NcConnectionMgrv2 {
  private static connectionRefs: {
    [projectId: string]: {
      [baseId: string]: XKnex;
    };
  } = {};

  public static async destroyAll() {
    for (const projectId in this.connectionRefs) {
      for (const baseId in this.connectionRefs[projectId]) {
        await this.connectionRefs[projectId][baseId].destroy();
      }
    }
  }

  // Todo: Should await on connection destroy
  public static delete(base: Base) {
    // todo: ignore meta projects
    if (this.connectionRefs?.[base.project_id]?.[base.id]) {
      try {
        const conn = this.connectionRefs?.[base.project_id]?.[base.id];
        conn.destroy();
        delete this.connectionRefs?.[base.project_id][base.id];
      } catch (e) {
        console.log(e);
      }
    }
  }

  public static async deleteAwait(base: Base) {
    // todo: ignore meta projects
    if (this.connectionRefs?.[base.project_id]?.[base.id]) {
      try {
        const conn = this.connectionRefs?.[base.project_id]?.[base.id];
        await conn.destroy();
        delete this.connectionRefs?.[base.project_id][base.id];
      } catch (e) {
        console.log(e);
      }
    }
  }

  // NC_DATA_DB is not available in community version
  // make it return Promise<XKnex> to avoid conflicts
  public static async get(base: Base): Promise<XKnex> {
    if (base.is_meta) return Noco.ncMeta.knex;

    if (this.connectionRefs?.[base.project_id]?.[base.id]) {
      return this.connectionRefs?.[base.project_id]?.[base.id];
    }
    this.connectionRefs[base.project_id] =
      this.connectionRefs?.[base.project_id] || {};

    const connectionConfig = await base.getConnectionConfig();

    this.connectionRefs[base.project_id][base.id] = XKnex({
      ...defaultConnectionOptions,
      ...connectionConfig,
      connection: {
        ...defaultConnectionConfig,
        ...connectionConfig.connection,
        typeCast(_field, next) {
          const res = next();
          if (res instanceof Buffer) {
            return [...res]
              .map((v) => ('00' + v.toString(16)).slice(-2))
              .join('');
          }
          return res;
        },
      },
    } as any);
    return this.connectionRefs[base.project_id][base.id];
  }

  // private static getConnectionConfig(
  //   config: NcConfig,
  //   env: string,
  //   dbAlias: string
  // ) {
  //   return config?.envs?.[env]?.db?.find(db => db?.meta?.dbAlias === dbAlias);
  // }

  public static async getSqlClient(base: Base, _knex = null) {
    const knex = _knex || this.get(base);
    return SqlClientFactory.create({
      knex,
      ...(await base.getConnectionConfig()),
    });
  }
}
