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
import { DbMux } from '~/models';
import { NcError } from '~/helpers/catchError';
import { DbMuxStatus } from '~/utils/globals';
import SqlClientFactory from '~/db/sql-client/lib/SqlClientFactory';
import {
  getWorkspaceDbConnection,
  getWorkspaceDbServer,
} from '~/utils/cloudDb';
import { isMuxEnabled } from '~/utils/envs';

export default class NcConnectionMgrv2 extends NcConnectionMgrv2CE {
  protected static dataKnex?: XKnex;
  protected static dataConfig?: Knex.Config;

  public static async get(source: Source): Promise<XKnex> {
    /*
      This is a partial implementation for upgrader mode (Only for EE rn).
      If upgrader mode is enabled all queries will be stored instead of running them.
      TODO:
      - Move knex raw override to CustomKnex level
      - Implement it for OSS

      This is not used yet as we manually push queries on `nc_job_005_order_column` migration job.
      For future migrations we are planning to use this.
    */
    if (source.upgraderMode === true) {
      const connectionConfig = await source.getConnectionConfig();

      return XKnex(
        {
          client: connectionConfig.client,
        },
        {
          context: {
            base_id: source.base_id,
            workspace_id: source.fk_workspace_id,
          },
          source: source,
          upgrader: true,
        },
      );
    }

    if (source.isMeta()) {
      const dbConnection = await getWorkspaceDbConnection(
        source.fk_workspace_id,
      );
      if (dbConnection) {
        return dbConnection;
      }

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

    if (!isMuxEnabled) {
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
      return this.connectionRefs[source.base_id][source.id];
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

    const { client, connection, searchPath, pool } = finalConfig;

    let se: DbMux;

    if ((source as any).fk_sql_executor_id) {
      se = await DbMux.get((source as any).fk_sql_executor_id);
    } else {
      se = await DbMux.bindToSuitableDbMux(
        {
          workspace_id: source.fk_workspace_id,
          base_id: source.base_id,
        },
        source.id,
      );
    }

    if (!se) {
      NcError.internalServerError('There is no DB Mux available!');
    }

    if (
      se.status === DbMuxStatus.INACTIVE ||
      se.status === DbMuxStatus.DEPLOYING
    ) {
      try {
        const res = await axios.get(`${se.domain}/api/v1/health`);
        if (res.status !== 200) {
          NcError.internalServerError(
            'DB Mux is not active yet. Please try again later!',
          );
        }

        await se.update({
          status: DbMuxStatus.ACTIVE,
        });
      } catch (e) {
        NcError.internalServerError(
          'DB Mux is not active yet. Please try again later!',
        );
      }
    }

    this.connectionRefs[source.base_id][source.id] = XKnex(
      {
        client,
      },
      {
        dbMux: se.domain,
        sourceId: source.id,
        client,
        connection,
        searchPath,
        pool,
      },
    );

    return this.connectionRefs[source.base_id][source.id];
  }

  public static async getSqlClient(source: Source, _knex = null) {
    if (source.isMeta() && source.fk_workspace_id) {
      const workspaceSqlClient = await this.getWorkspaceSqlClient(
        source.fk_workspace_id,
      );
      if (workspaceSqlClient) {
        return workspaceSqlClient;
      }
    }

    const knex = _knex || (await this.get(source));
    return SqlClientFactory.create({
      knex,
      ...(await source.getConnectionConfig()),
    });
  }

  public static async getWorkspaceSqlClient(workspaceId: string) {
    const dbServer = await getWorkspaceDbServer(workspaceId);
    const dbConnection = await getWorkspaceDbConnection(workspaceId);
    if (dbServer) {
      return SqlClientFactory.create({
        knex: dbConnection,
        ...dbServer.config,
      });
    }
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

  public static async getWorkspaceDataConfig(workspaceId: string) {
    const dbServer = await getWorkspaceDbServer(workspaceId);
    if (dbServer) {
      return dbServer.config;
    }
    return this.getDataConfig();
  }

  public static async getWorkspaceDataKnex(workspaceId: string) {
    const dbConnection = await getWorkspaceDbConnection(workspaceId);
    if (dbConnection) {
      return dbConnection;
    }
    return this.getDataKnex();
  }

  public static async getDataKnex?() {
    if (!this.dataKnex) {
      await this.getDataConfig();
      this.dataKnex = XKnex(this.dataConfig);
    }
    return this.dataKnex;
  }
}
