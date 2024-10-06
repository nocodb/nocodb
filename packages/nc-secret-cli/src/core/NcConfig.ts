import * as path from 'path';
import fs from 'fs';
import { promisify } from 'util';
const { DriverClient, getToolDir, metaUrlToDbConfig } = require( '../nocodb/cli');

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

  credentialSecret?: string;

  private constructor() {
    this.toolDir = getToolDir();
  }

  public static async create(param: {
    meta: {
      metaUrl?: string;
      metaJson?: string;
      metaJsonFile?: string;
    };
    secret?: string;
    credentialSecret?: string;
  }): Promise<NcConfig> {
    const { meta, secret } =
      param;

    const ncConfig = new NcConfig();


    ncConfig.credentialSecret = param.credentialSecret;


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
      credentialSecret: process.env.NC_KEY_CREDENTIAL_ENCRYPT,
    });
  }
}

export const getNocoConfig = () =>{
  return NcConfig.create({
    meta: {
      metaUrl: process.env.NC_DB,
      metaJson: process.env.NC_DB_JSON,
      metaJsonFile: process.env.NC_DB_JSON_FILE,
    },
    secret: process.env.NC_AUTH_JWT_SECRET,
    credentialSecret: process.env.NC_KEY_CREDENTIAL_ENCRYPT,
  });
}
