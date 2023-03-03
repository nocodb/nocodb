import SqlClientFactory from '../../db/sql-client/lib/SqlClientFactory';
import { XKnex } from '../../db/sql-data-mapper';
// import { NcConfig } from '../../../interface/config';
// import fs from 'fs';
// import Knex from 'knex';

// import NcMetaIO from '../meta/NcMetaIO';
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

  // private static metaKnex: NcMetaIO;
  //
  // public static setXcMeta(ncMeta: NcMetaIO) {
  //   this.metaKnex = ncMeta;
  // }

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

  public static get(base: Base): XKnex {
    if (base.is_meta) return Noco.ncMeta.knex;

    if (this.connectionRefs?.[base.project_id]?.[base.id]) {
      return this.connectionRefs?.[base.project_id]?.[base.id];
    }
    this.connectionRefs[base.project_id] =
      this.connectionRefs?.[base.project_id] || {};
    // if (?.prefix && this.metaKnex) {
    //   this.connectionRefs[projectId][env][dbAlias] = this.metaKnex?.knex;
    // } else {
    //   const connectionConfig = this.getConnectionConfig(config, env, dbAlias);
    const connectionConfig = base.getConnectionConfig();
    //
    //   if (
    //     connectionConfig?.connection?.ssl &&
    //     typeof connectionConfig?.connection?.ssl === 'object'
    //   ) {
    //     if (
    //       connectionConfig.connection.ssl.caFilePath &&
    //       !connectionConfig.connection.ssl.ca
    //     ) {
    //       connectionConfig.connection.ssl.ca = fs
    //         .readFileSync(connectionConfig.connection.ssl.caFilePath)
    //         .toString();
    //     }
    //     if (
    //       connectionConfig.connection.ssl.keyFilePath &&
    //       !connectionConfig.connection.ssl.key
    //     ) {
    //       connectionConfig.connection.ssl.key = fs
    //         .readFileSync(connectionConfig.connection.ssl.keyFilePath)
    //         .toString();
    //     }
    //     if (
    //       connectionConfig.connection.ssl.certFilePath &&
    //       !connectionConfig.connection.ssl.cert
    //     ) {
    //       connectionConfig.connection.ssl.cert = fs
    //         .readFileSync(connectionConfig.connection.ssl.certFilePath)
    //         .toString();
    //     }
    //   }
    //
    //   const isSqlite = connectionConfig?.client === 'sqlite3';
    //
    //   if (connectionConfig?.connection?.port) {
    //     connectionConfig.connection.port = +connectionConfig.connection.port;
    //   }

    this.connectionRefs[base.project_id][base.id] = XKnex(
      // isSqlite
      //   ? (connectionConfig.connection as Knex.Config)
      //   :
      {
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
      } as any
    );
    // if (isSqlite) {
    //   this.connectionRefs[projectId][env][dbAlias]
    //     .raw(`PRAGMA journal_mode=WAL;`)
    //     .then(() => {});
    // }

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
      ...base.getConnectionConfig(),
    });
  }
}
