import type Source from '~/models/Source';
import {
  defaultConnectionConfig,
  defaultConnectionOptions,
} from '~/utils/nc-config';
import SqlClientFactory from '~/db/sql-client/lib/SqlClientFactory';
import { XKnex } from '~/db/CustomKnex';
import Noco from '~/Noco';

export default class NcConnectionMgrv2 {
  protected static connectionRefs: {
    [baseId: string]: {
      [sourceId: string]: XKnex;
    };
  } = {};

  public static async destroyAll() {
    for (const baseId in this.connectionRefs) {
      for (const sourceId in this.connectionRefs[baseId]) {
        await this.connectionRefs[baseId][sourceId].destroy();
      }
    }
  }

  // Todo: Should await on connection destroy
  public static delete(source: Source) {
    // todo: ignore meta bases
    if (this.connectionRefs?.[source.base_id]?.[source.id]) {
      try {
        const conn = this.connectionRefs?.[source.base_id]?.[source.id];
        conn.destroy();
        delete this.connectionRefs?.[source.base_id][source.id];
      } catch (e) {
        console.log(e);
      }
    }
  }

  public static async deleteAwait(source: Source) {
    // todo: ignore meta bases
    if (this.connectionRefs?.[source.base_id]?.[source.id]) {
      try {
        const conn = this.connectionRefs?.[source.base_id]?.[source.id];
        await conn.destroy();
        delete this.connectionRefs?.[source.base_id][source.id];
      } catch (e) {
        console.log(e);
      }
    }
  }

  public static async get(source: Source): Promise<XKnex> {
    if (source.isMeta()) return Noco.ncMeta.knex;

    if (this.connectionRefs?.[source.base_id]?.[source.id]) {
      return this.connectionRefs?.[source.base_id]?.[source.id];
    }
    this.connectionRefs[source.base_id] =
      this.connectionRefs?.[source.base_id] || {};

    const connectionConfig = await source.getConnectionConfig();

    this.connectionRefs[source.base_id][source.id] = XKnex({
      ...defaultConnectionOptions,
      ...connectionConfig,
      connection: {
        ...defaultConnectionConfig,
        ...connectionConfig.connection,
        typeCast(field, next) {
          const res = next();

          // mysql `bit` datatype returns value as Buffer, convert it to integer number
          if (field.type == 'BIT' && res && res instanceof Buffer) {
            return parseInt(
              [...res].map((v) => ('00' + v.toString(16)).slice(-2)).join(''),
              16,
            );
          }

          // mysql `decimal` datatype returns value as string, convert it to float number
          if (field.type == 'NEWDECIMAL') {
            return res && parseFloat(res);
          }

          return res;
        },
      },
    } as any);
    return this.connectionRefs[source.base_id][source.id];
  }

  public static async getSqlClient(source: Source, _knex = null) {
    const knex = _knex || (await this.get(source));
    return SqlClientFactory.create({
      knex,
      ...(await source.getConnectionConfig()),
    });
  }
}
