import type Base from '~/models/Base';
import {
  defaultConnectionConfig,
  defaultConnectionOptions,
} from '~/utils/nc-config';
import SqlClientFactory from '~/db/sql-client/lib/SqlClientFactory';
import { XKnex } from '~/db/CustomKnex';
import Noco from '~/Noco';

export default class NcConnectionMgrv2 {
  protected static connectionRefs: {
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

  public static async get(base: Base): Promise<XKnex> {
    if (base.isMeta()) return Noco.ncMeta.knex;

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

  public static async getSqlClient(base: Base, _knex = null) {
    const knex = _knex || (await this.get(base));
    return SqlClientFactory.create({
      knex,
      ...(await base.getConnectionConfig()),
    });
  }
}
