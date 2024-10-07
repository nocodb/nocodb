import * as path from 'path';
import fs from 'fs';
import { promisify } from 'util';
const {
  DriverClient,
  getToolDir,
  metaUrlToDbConfig,
  prepareEnv,
} = require('../nocodb/cli');

export class NcConfig {
  meta: {
    db: any;
  } = {
    db: {
      client: DriverClient.SQLITE,
      connection: {
        filename: 'noco.db',
      },
    },
  };

  toolDir: string;

  private constructor() {
    this.toolDir = getToolDir();
  }

  public static async create(param: {
    meta: {
      metaUrl?: string;
      metaJson?: string;
      metaJsonFile?: string;
      databaseUrlFile?: string;
      databaseUrl?: string;
    };
    secret?: string;
  }): Promise<NcConfig> {
    const { meta } = param;

    const ncConfig = new NcConfig();

    if (ncConfig.meta?.db?.connection?.filename) {
      ncConfig.meta.db.connection.filename = path.join(
        ncConfig.toolDir,
        ncConfig.meta.db.connection.filename,
      );
    }

    if (meta?.metaUrl) {
      ncConfig.meta.db = await metaUrlToDbConfig(meta.metaUrl);
    } else if (meta?.metaJson) {
      ncConfig.meta.db = JSON.parse(meta.metaJson);
    } else if (meta?.metaJsonFile) {
      if (!(await promisify(fs.exists)(meta.metaJsonFile))) {
        throw new Error(`NC_DB_JSON_FILE not found: ${meta.metaJsonFile}`);
      }
      const fileContent = await promisify(fs.readFile)(meta.metaJsonFile, {
        encoding: 'utf8',
      });
      ncConfig.meta.db = JSON.parse(fileContent);
    }

    return ncConfig;
  }

  public static async createByEnv(): Promise<NcConfig> {
    return NcConfig.create({
      meta: {
        metaUrl: process.env.NC_DB,
        metaJson: process.env.NC_DB_JSON,
        metaJsonFile: process.env.NC_DB_JSON_FILE,
      },
      secret: process.env.NC_AUTH_JWT_SECRET,
    });
  }
}

export const getNocoConfig = async (
  options: {
    ncDb?: string;
    ncDbJson?: string;
    ncDbJsonFile?: string;
    databaseUrl?: string;
    databaseUrlFile?: string;
  } = {},
) => {
  // check for JDBC url specified in env or options
  await prepareEnv({
    databaseUrl:
      options.databaseUrl ||
      process.env.NC_DATABASE_URL ||
      process.env.DATABASE_URL,
    databaseUrlFile:
      options.databaseUrlFile ||
      process.env.NC_DATABASE_URL_FILE ||
      process.env.DATABASE_URL_FILE,
  });

  // create NocoConfig using utility method which works similar to Nocodb NcConfig with only meta db config
  return NcConfig.create({
    meta: {
      metaUrl: process.env.NC_DB || options.ncDb,
      metaJson: process.env.NC_DB_JSON || options.ncDbJson,
      metaJsonFile: process.env.NC_DB_JSON_FILE || options.ncDbJsonFile,
    },
  });
};
