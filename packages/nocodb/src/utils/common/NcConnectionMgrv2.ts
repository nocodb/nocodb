import { promisify } from 'util';
import fs from 'fs';
import SqlClientFactory from '../../db/sql-client/lib/SqlClientFactory';
import { XKnex } from '../../db/CustomKnex';
import {
  defaultConnectionConfig,
  defaultConnectionOptions,
  jdbcToXcConfig,
  metaUrlToDbConfig,
} from '../nc-config';
import Noco from '../../Noco';
import type Base from '~/models/Base';
import type { Knex } from 'knex';

export default class NcConnectionMgrv2 {
  private static connectionRefs: {
    [projectId: string]: {
      [baseId: string]: XKnex;
    };
  } = {};

  private static dataKnex: XKnex;
  private static dataConfig: Knex.Config;

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
    if (base.is_meta || base.is_local) {
      // if data db is set, use it for generating knex connection
      if (!this.dataKnex) {
        await this.getDataConfig();
        this.dataKnex = XKnex(this.dataConfig);
      }
      return this.dataKnex;
    }

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

  public static async getDataConfig() {
    // if data db is set, use it for generating knex connection
    if (process.env.NC_DATA_DB) {
      if (!this.dataConfig)
        this.dataConfig = await metaUrlToDbConfig(process.env.NC_DATA_DB);
      return this.dataConfig;
      // if data db json is set, use it for generating knex connection
    } else if (process.env.NC_DATA_DB_JSON) {
      try {
        this.dataConfig = JSON.parse(process.env.NC_DATA_DB_JSON);
      } catch (e) {
        throw new Error(
          `NC_DATA_DB_JSON is not a valid JSON: ${process.env.NC_DATA_DB_JSON}`,
        );
      }
      // if data db json file is set, use it for generating knex connection
    } else if (process.env.NC_DATA_DB_JSON_FILE) {
      const filePath = process.env.NC_DATA_DB_JSON_FILE;

      if (!(await promisify(fs.exists)(filePath))) {
        throw new Error(`NC_DATA_DB_JSON_FILE not found: ${filePath}`);
      }

      const fileContent = await promisify(fs.readFile)(filePath, {
        encoding: 'utf8',
      });
      try {
        this.dataConfig = JSON.parse(fileContent);
      } catch (e) {
        throw new Error(
          `NC_DATA_DB_JSON_FILE is not a valid JSON: ${filePath}`,
        );
      }
      // if jdbc url is set, use it for generating knex connection
    } else if (process.env.DATA_DATABASE_URL) {
      this.dataConfig = await jdbcToXcConfig(process.env.DATA_DATABASE_URL);
    } else {
      if (!this.dataConfig) {
        this.dataConfig = Noco.getConfig()?.meta?.db;
      }
      return this.dataConfig;
    }
  }

  public static async getSqlClient(base: Base, _knex = null) {
    const knex = _knex || (await this.get(base));
    return SqlClientFactory.create({
      knex,
      ...(await base.getConnectionConfig()),
    });
  }
}
