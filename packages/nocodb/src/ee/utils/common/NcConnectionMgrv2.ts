import { promisify } from 'util';
import fs from 'fs';
import axios from 'axios';
import { default as NcConnectionMgrv2CE } from 'src/utils/common/NcConnectionMgrv2';
import type { Knex } from 'knex';
import type Source from '~/models/Source';
import {
  defaultConnectionConfig,
  defaultConnectionOptions,
  jdbcToXcConfig,
  metaUrlToDbConfig,
} from '~/utils/nc-config';
import { XKnex } from '~/db/CustomKnex';
import Noco from '~/Noco';
import { SqlExecutor } from '~/models';
import { NcError } from '~/helpers/catchError';

export default class NcConnectionMgrv2 extends NcConnectionMgrv2CE {
  protected static dataKnex?: XKnex;
  protected static dataConfig?: Knex.Config;

  public static async get(source: Source): Promise<XKnex> {
    if (source.isMeta()) {
      // if data db is set, use it for generating knex connection
      if (!this.dataKnex) {
        await this.getDataConfig();
        this.dataKnex = XKnex(this.dataConfig);
      }
      return this.dataKnex;
    }

    if (this.connectionRefs?.[source.base_id]?.[source.id]) {
      return this.connectionRefs?.[source.base_id]?.[source.id];
    }
    this.connectionRefs[source.base_id] =
      this.connectionRefs?.[source.base_id] || {};

    const connectionConfig = await source.getConnectionConfig();

    const finalConfig = {
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
    } as any;

    const { client, connection, searchPath: _searchPath, pool } = finalConfig;

    let se;

    if ((source as any).fk_sql_executor_id) {
      se = await SqlExecutor.get((source as any).fk_sql_executor_id);
    } else {
      se = await SqlExecutor.bindToSuitableSqlExecutor(source.id);
    }

    if (!se) {
      NcError.internalServerError('There is no SQL Executor available!');
    }

    if (se.status === 'inactive') {
      try {
        const res = await axios.get(`${se.domain}/health`);
        if (res.status !== 200) {
          NcError.internalServerError(
            'SQL Executor is not active yet. Please try again later!',
          );
        }

        await SqlExecutor.update(se.id, {
          status: 'active',
        });
      } catch (e) {
        NcError.internalServerError(
          'SQL Executor is not active yet. Please try again later!',
        );
      }
    }

    this.connectionRefs[source.base_id][source.id] = XKnex(
      {
        client,
      },
      {
        sqlExecutor: se.domain,
        client,
        connection,
        // searchPath,
        pool,
      },
    );

    return this.connectionRefs[source.base_id][source.id];
  }

  public static async getDataConfig?() {
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
}
