import fs from 'fs';
import { promisify } from 'util';
import { defaultConnectionConfig } from '../nc-config';
import type { Knex } from 'knex';
import SqlClientFactory from '~/db/sql-client/lib/SqlClientFactory';
import { XKnex } from '~/db/CustomKnex';
// import type { NcConfig } from '~/interface/config';
// import type NcMetaIO from '~/meta/NcMetaIO';

export default class NcConnectionMgr {
  private static connectionRefs: {
    [baseId: string]: {
      [env: string]: {
        [dbAlias: string]: XKnex;
      };
    };
  } = {};

  private static metaKnex: any;

  public static setXcMeta(ncMeta: any) {
    this.metaKnex = ncMeta;
  }

  public static delete({
    dbAlias = 'db',
    env = '_noco',
    baseId,
  }: {
    dbAlias: string;
    env: string;
    baseId: string;
  }) {
    // todo: ignore meta bases
    if (this.connectionRefs?.[baseId]?.[env]?.[dbAlias]) {
      try {
        const conn = this.connectionRefs[baseId][env][dbAlias];
        conn.destroy();
        delete this.connectionRefs[baseId][env][dbAlias];
      } catch (e) {
        console.log(e);
      }
    }
  }

  public static async get({
    dbAlias = 'db',
    env = '_noco',
    config,
    baseId,
  }: {
    dbAlias: string;
    env: string;
    config: any;
    baseId: string;
  }): Promise<XKnex> {
    if (this.connectionRefs?.[baseId]?.[env]?.[dbAlias]) {
      return this.connectionRefs?.[baseId]?.[env]?.[dbAlias];
    }
    this.connectionRefs[baseId] = this.connectionRefs[baseId] || {};
    this.connectionRefs[baseId][env] = this.connectionRefs[baseId][env] || {};
    if (config?.prefix && this.metaKnex) {
      this.connectionRefs[baseId][env][dbAlias] = this.metaKnex?.knex;
    } else {
      const connectionConfig = this.getConnectionConfig(config, env, dbAlias);

      if (
        connectionConfig?.connection?.ssl &&
        typeof connectionConfig?.connection?.ssl === 'object'
      ) {
        if (
          connectionConfig.connection.ssl.caFilePath &&
          !connectionConfig.connection.ssl.ca
        ) {
          connectionConfig.connection.ssl.ca = (
            await promisify(fs.readFile)(
              connectionConfig.connection.ssl.caFilePath,
            )
          ).toString();
          delete connectionConfig.connection.ssl.caFilePath;
        }
        if (
          connectionConfig.connection.ssl.keyFilePath &&
          !connectionConfig.connection.ssl.key
        ) {
          connectionConfig.connection.ssl.key = (
            await promisify(fs.readFile)(
              connectionConfig.connection.ssl.keyFilePath,
            )
          ).toString();
          delete connectionConfig.connection.ssl.keyFilePath;
        }
        if (
          connectionConfig.connection.ssl.certFilePath &&
          !connectionConfig.connection.ssl.cert
        ) {
          connectionConfig.connection.ssl.cert = (
            await promisify(fs.readFile)(
              connectionConfig.connection.ssl.certFilePath,
            )
          ).toString();
          delete connectionConfig.connection.ssl.certFilePath;
        }
      }

      const isSqlite = connectionConfig?.client === 'sqlite3';

      if (connectionConfig?.connection?.port) {
        connectionConfig.connection.port = +connectionConfig.connection.port;
      }

      this.connectionRefs[baseId][env][dbAlias] = XKnex(
        isSqlite
          ? (connectionConfig.connection as Knex.Config)
          : ({
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
            } as any),
      );
      if (isSqlite) {
        this.connectionRefs[baseId][env][dbAlias]
          .raw(`PRAGMA journal_mode=WAL;`)
          .then(() => {});
      }
    }
    return this.connectionRefs[baseId][env][dbAlias];
  }

  private static getConnectionConfig(
    config: any,
    env: string,
    dbAlias: string,
  ) {
    return config?.envs?.[env]?.db?.find((db) => db?.meta?.dbAlias === dbAlias);
  }

  public static async getSqlClient({
    baseId,
    dbAlias = 'db',
    env = '_noco',
    config,
  }: {
    dbAlias: string;
    env: string;
    config: any;
    baseId: string;
  }) {
    const knex = this.get({
      dbAlias,
      env,
      config,
      baseId,
    });
    return SqlClientFactory.create({
      knex,
      ...this.getConnectionConfig(config, env, dbAlias),
    });
  }
}
