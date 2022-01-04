import { SqlClientFactory } from 'nc-help';
import fs from 'fs';
import parseDbUrl from 'parse-database-url';

import {
  AuthConfig,
  DbConfig,
  MailerConfig,
  NcConfig
} from '../../interface/config';
import * as path from 'path';

const {
  uniqueNamesGenerator,
  starWars,
  adjectives,
  animals
} = require('unique-names-generator');

const driverClientMapping = {
  mysql: 'mysql2',
  postgres: 'pg',
  sqlite: 'sqlite3',
  mssql: 'mssql'
};

const defaultClientPortMapping = {
  mysql: 3306,
  mysql2: 3306,
  postgres: 5432,
  pg: 5432,
  mssql: 1433
};

const defaultConnectionConfig: any = {
  // https://github.com/knex/knex/issues/97
  // timezone: process.env.NC_TIMEZONE || 'UTC',
  dateStrings: true
};

export default class NcConfigFactory implements NcConfig {
  public static make(): NcConfig {
    this.jdbcToXcUrl();

    const config = new NcConfigFactory();

    config.auth = {
      jwt: {
        secret: process.env.NC_AUTH_JWT_SECRET
      }
    };

    config.port = +(process?.env?.PORT ?? 8080);
    config.env = '_noco'; // process.env?.NODE_ENV || 'dev';
    config.workingEnv = '_noco'; // process.env?.NODE_ENV || 'dev';
    // config.toolDir = this.getToolDir();
    config.projectType =
      config?.envs?.[config.workingEnv]?.db?.[0]?.meta?.api?.type || 'rest';

    if (config.meta?.db?.connection?.filename) {
      config.meta.db.connection.filename = path.join(
        this.getToolDir(),
        config.meta.db.connection.filename
      );
    }

    if (process.env.NC_DB_JSON) {
      config.meta.db = JSON.parse(process.env.NC_DB_JSON);
    } else if (process.env.NC_DB_JSON_FILE) {
      const filePath = process.env.NC_DB_JSON_FILE;

      if (!fs.existsSync(filePath)) {
        throw new Error(`NC_DB_JSON_FILE not found: ${filePath}`);
      }

      const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
      config.meta.db = JSON.parse(fileContent);
    } else if (process.env.NC_DB) {
      config.meta.db = this.metaUrlToDbConfig(process.env.NC_DB);
    }

    if (process.env.NC_TRY) {
      config.try = true;
      config.meta.db = {
        client: 'sqlite3',
        connection: ':memory:',
        pool: {
          min: 1,
          max: 1,
          // disposeTimeout: 360000*1000,
          idleTimeoutMillis: 360000 * 1000
        }
      } as any;
    }

    if (process.env.NC_PUBLIC_URL) {
      config.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
      // config.envs[process.env.NODE_ENV || 'dev'].publicUrl = process.env.NC_PUBLIC_URL;
      config.publicUrl = process.env.NC_PUBLIC_URL;
    }

    if (process.env.NC_DASHBOARD_URL) {
      config.dashboardPath = process.env.NC_DASHBOARD_URL;
    }

    return config;
  }

  public static getToolDir() {
    return process.env.NC_TOOL_DIR || process.cwd();
  }

  public static hasDbUrl(): boolean {
    return Object.keys(process.env).some(envKey =>
      envKey.startsWith('NC_DB_URL')
    );
  }

  public static makeFromUrls(urls: string[]): NcConfig {
    const config = new NcConfigFactory();

    // config.envs[process.env.NODE_ENV || 'dev'].db = [];
    config.envs['_noco'].db = [];
    for (const [i, url] of Object.entries(urls)) {
      // config.envs[process.env.NODE_ENV || 'dev'].db.push(this.urlToDbConfig(url, i));
      config.envs['_noco'].db.push(this.urlToDbConfig(url, i));
    }

    return config;
  }

  public static urlToDbConfig(
    urlString: string,
    key?: string,
    config?: NcConfigFactory,
    type?: string
  ): DbConfig {
    const url = new URL(urlString);

    let dbConfig: DbConfig;

    if (url.protocol.startsWith('sqlite3')) {
      dbConfig = {
        client: 'sqlite3',
        connection: {
          client: 'sqlite3',
          connection: {
            filename:
              url.searchParams.get('d') || url.searchParams.get('database')
          },
          database:
            url.searchParams.get('d') || url.searchParams.get('database'),
          useNullAsDefault: true
        }
      } as any;
    } else {
      dbConfig = {
        client: url.protocol.replace(':', ''),
        connection: {
          ...defaultConnectionConfig,
          database:
            url.searchParams.get('d') || url.searchParams.get('database'),
          host: url.hostname,
          password:
            url.searchParams.get('p') || url.searchParams.get('password'),
          port: +url.port,
          user: url.searchParams.get('u') || url.searchParams.get('user'),
          timezone: 'utc'
        },
        // pool: {
        //   min: 1,
        //   max: 1
        // },
        acquireConnectionTimeout: 600000
      } as any;

      if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
        dbConfig.connection.ssl = true;
      }

      if (
        url.searchParams.get('keyFilePath') &&
        url.searchParams.get('certFilePath') &&
        url.searchParams.get('caFilePath')
      ) {
        dbConfig.connection.ssl = {
          keyFilePath: url.searchParams.get('keyFilePath'),
          certFilePath: url.searchParams.get('certFilePath'),
          caFilePath: url.searchParams.get('caFilePath')
        };
      }
    }

    if (config && !config.title) {
      config.title =
        url.searchParams.get('t') ||
        url.searchParams.get('title') ||
        this.generateRandomTitle();
    }

    Object.assign(dbConfig, {
      meta: {
        tn: 'nc_evolutions',
        allSchemas:
          !!url.searchParams.get('allSchemas') ||
          !(url.searchParams.get('d') || url.searchParams.get('database')),
        api: {
          prefix: url.searchParams.get('apiPrefix') || '',
          swagger: true,
          type:
            type ||
            ((url.searchParams.get('api') ||
              url.searchParams.get('a')) as any) ||
            'rest'
        },
        dbAlias: url.searchParams.get('dbAlias') || `db${key}`,
        metaTables: 'db',
        migrations: {
          disabled: false,
          name: 'nc_evolutions'
        }
      }
    });

    return dbConfig;
  }

  private static generateRandomTitle(): string {
    return uniqueNamesGenerator({
      dictionaries: [[starWars], [adjectives, animals]][
        Math.floor(Math.random() * 2)
      ]
    })
      .toLowerCase()
      .replace(/[ -]/g, '_');
  }

  static metaUrlToDbConfig(urlString) {
    const url = new URL(urlString);

    let dbConfig;

    if (url.protocol.startsWith('sqlite3')) {
      const db = url.searchParams.get('d') || url.searchParams.get('database');
      dbConfig = {
        client: 'sqlite3',
        connection: {
          filename: db
        },
        ...(db === ':memory:'
          ? {
              pool: {
                min: 1,
                max: 1,
                // disposeTimeout: 360000*1000,
                idleTimeoutMillis: 360000 * 1000
              }
            }
          : {})
      };
    } else {
      dbConfig = {
        client: url.protocol.replace(':', ''),
        connection: {
          ...defaultConnectionConfig,
          database:
            url.searchParams.get('d') || url.searchParams.get('database'),
          host: url.hostname,
          password:
            url.searchParams.get('p') || url.searchParams.get('password'),
          port: +url.port,
          user: url.searchParams.get('u') || url.searchParams.get('user')
        },
        acquireConnectionTimeout: 600000,
        ...(url.searchParams.has('search_path')
          ? {
              searchPath: url.searchParams.get('search_path').split(',')
            }
          : {})
      };
      if (process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
        dbConfig.connection.ssl = true;
      }
    }
    url.searchParams.forEach((_value, key) => {
      let value: any = _value;
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (/^\d+$/.test(value)) {
        value = +value;
      }
      // todo: implement config read from JSON file or JSON env val read
      if (
        ![
          'password',
          'p',
          'database',
          'd',
          'user',
          'u',
          'search_path'
        ].includes(key)
      ) {
        key.split('.').reduce((obj, k, i, arr) => {
          return (obj[k] = i === arr.length - 1 ? value : obj[k] || {});
        }, dbConfig);
      }
    });

    if (
      dbConfig?.connection?.ssl &&
      typeof dbConfig?.connection?.ssl === 'object'
    ) {
      if (dbConfig.connection.ssl.caFilePath && !dbConfig.connection.ssl.ca) {
        dbConfig.connection.ssl.ca = fs
          .readFileSync(dbConfig.connection.ssl.caFilePath)
          .toString();
      }
      if (dbConfig.connection.ssl.keyFilePath && !dbConfig.connection.ssl.key) {
        dbConfig.connection.ssl.key = fs
          .readFileSync(dbConfig.connection.ssl.keyFilePath)
          .toString();
      }
      if (
        dbConfig.connection.ssl.certFilePath &&
        !dbConfig.connection.ssl.cert
      ) {
        dbConfig.connection.ssl.cert = fs
          .readFileSync(dbConfig.connection.ssl.certFilePath)
          .toString();
      }
    }

    return dbConfig;
  }

  public static makeProjectConfigFromUrl(url, type?: string): NcConfig {
    const config = new NcConfigFactory();
    const dbConfig = this.urlToDbConfig(url, '', config, type);
    // config.envs[process.env.NODE_ENV || 'dev'].db.push(dbConfig);
    config.envs['_noco'].db.push(dbConfig);

    if (process.env.NC_AUTH_ADMIN_SECRET) {
      config.auth = {
        masterKey: {
          secret: process.env.NC_AUTH_ADMIN_SECRET
        }
      };
    } else if (process.env.NC_NO_AUTH) {
      config.auth = {
        disabled: true
      };
      // } else if (config?.envs?.[process.env.NODE_ENV || 'dev']?.db?.[0]) {
    } else if (config?.envs?.['_noco']?.db?.[0]) {
      config.auth = {
        jwt: {
          // dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS || config.envs[process.env.NODE_ENV || 'dev'].db[0].meta.dbAlias,
          dbAlias:
            process.env.NC_AUTH_JWT_DB_ALIAS ||
            config.envs['_noco'].db[0].meta.dbAlias,
          secret: process.env.NC_AUTH_JWT_SECRET
        }
      };
    }

    if (process.env.NC_DB) {
      config.meta.db = this.metaUrlToDbConfig(process.env.NC_DB);
    }

    if (process.env.NC_TRY) {
      config.try = true;
      config.meta.db = {
        client: 'sqlite3',
        connection: ':memory:',
        pool: {
          min: 1,
          max: 1,
          // disposeTimeout: 360000*1000,
          idleTimeoutMillis: 360000 * 1000
        }
      } as any;
    }

    if (process.env.NC_MAILER) {
      config.mailer = {
        from: process.env.NC_MAILER_FROM,
        options: {
          host: process.env.NC_MAILER_HOST,
          port: parseInt(process.env.NC_MAILER_PORT, 10),
          secure: process.env.NC_MAILER_SECURE === 'true',
          auth: {
            user: process.env.NC_MAILER_USER,
            pass: process.env.NC_MAILER_PASS
          }
        }
      };
    }

    if (process.env.NC_PUBLIC_URL) {
      // config.envs[process.env.NODE_ENV || 'dev'].publicUrl = process.env.NC_PUBLIC_URL;
      config.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
      config.publicUrl = process.env.NC_PUBLIC_URL;
    }

    config.port = +(process?.env?.PORT ?? 8080);
    // config.env = process.env?.NODE_ENV || 'dev';
    // config.workingEnv = process.env?.NODE_ENV || 'dev';
    config.env = '_noco';
    config.workingEnv = '_noco';
    config.toolDir = this.getToolDir();
    config.projectType =
      type ||
      config?.envs?.[config.workingEnv]?.db?.[0]?.meta?.api?.type ||
      'rest';

    return config;
  }

  public static makeProjectConfigFromConnection(
    dbConnectionConfig: any,
    type?: string
  ): NcConfig {
    const config = new NcConfigFactory();
    let dbConfig = dbConnectionConfig;

    if (dbConfig.client === 'sqlite3') {
      dbConfig = {
        client: 'sqlite3',
        connection: {
          ...dbConnectionConfig,
          database: dbConnectionConfig.connection.filename,
          useNullAsDefault: true
        }
      };
    }

    // todo:
    const key = '';
    Object.assign(dbConfig, {
      meta: {
        tn: 'nc_evolutions',
        api: {
          prefix: '',
          swagger: true,
          type: type || 'rest'
        },
        dbAlias: `db${key}`,
        metaTables: 'db',
        migrations: {
          disabled: false,
          name: 'nc_evolutions'
        }
      }
    });

    // config.envs[process.env.NODE_ENV || 'dev'].db.push(dbConfig);
    config.envs['_noco'].db.push(dbConfig);

    if (process.env.NC_AUTH_ADMIN_SECRET) {
      config.auth = {
        masterKey: {
          secret: process.env.NC_AUTH_ADMIN_SECRET
        }
      };
    } else if (process.env.NC_NO_AUTH) {
      config.auth = {
        disabled: true
      };
      // } else if (config?.envs?.[process.env.NODE_ENV || 'dev']?.db?.[0]) {
    } else if (config?.envs?.['_noco']?.db?.[0]) {
      config.auth = {
        jwt: {
          // dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS || config.envs[process.env.NODE_ENV || 'dev'].db[0].meta.dbAlias,
          dbAlias:
            process.env.NC_AUTH_JWT_DB_ALIAS ||
            config.envs['_noco'].db[0].meta.dbAlias,
          secret: process.env.NC_AUTH_JWT_SECRET
        }
      };
    }

    if (process.env.NC_DB) {
      config.meta.db = this.metaUrlToDbConfig(process.env.NC_DB);
    }

    if (process.env.NC_TRY) {
      config.try = true;
      config.meta.db = {
        client: 'sqlite3',
        connection: ':memory:',
        pool: {
          min: 1,
          max: 1,
          // disposeTimeout: 360000*1000,
          idleTimeoutMillis: 360000 * 1000
        }
      } as any;
    }

    if (process.env.NC_PUBLIC_URL) {
      // config.envs[process.env.NODE_ENV || 'dev'].publicUrl = process.env.NC_PUBLIC_URL;
      config.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
      config.publicUrl = process.env.NC_PUBLIC_URL;
    }

    config.port = +(process?.env?.PORT ?? 8080);
    // config.env = process.env?.NODE_ENV || 'dev';
    // config.workingEnv = process.env?.NODE_ENV || 'dev';
    config.env = '_noco';
    config.workingEnv = '_noco';
    config.toolDir = process.env.NC_TOOL_DIR || process.cwd();
    config.projectType =
      type ||
      config?.envs?.[config.workingEnv]?.db?.[0]?.meta?.api?.type ||
      'rest';

    return config;
  }

  public static async metaDbCreateIfNotExist(args: NcConfig) {
    if (args.meta?.db?.client === 'sqlite3') {
      const metaSqlClient = SqlClientFactory.create({
        ...args.meta.db,
        connection: args.meta.db
      });
      await metaSqlClient.createDatabaseIfNotExists({
        database: args.meta.db?.connection?.filename
      });
    } else {
      const metaSqlClient = SqlClientFactory.create(args.meta.db);
      await metaSqlClient.createDatabaseIfNotExists(args.meta.db?.connection);
      await metaSqlClient.knex.destroy();
    }

    /*    const dbPath = path.join(args.toolDir, 'xc.db')
        const exists = fs.existsSync(dbPath);
        if (!exists) {
          const fd = fs.openSync(dbPath, "w");
          fs.closeSync(fd);
        }*/
  }

  public version = '0.6';
  public port: number;
  public auth?: AuthConfig;
  public env: 'production' | 'dev' | 'test' | string;
  public workingEnv: string;
  public toolDir: string;
  public envs: {
    [p: string]: { db: DbConfig[]; api?: any; publicUrl?: string };
  };
  // public projectType: "rest" | "graphql" | "grpc";
  public queriesFolder: string | string[] = '';
  public seedsFolder: string | string[];
  public title: string;
  public publicUrl: string;
  public projectType;
  public meta = {
    db: {
      client: 'sqlite3',
      connection: {
        filename: 'noco.db',
        timezone: 'utc'
      }
    }
  };
  public mailer: MailerConfig;
  public try = false;

  public dashboardPath = '/dashboard';

  constructor() {
    this.envs = { _noco: { db: [] } };
  }

  public static jdbcToXcUrl() {
    if (process.env.NC_DATABASE_URL_FILE || process.env.DATABASE_URL_FILE) {
      const database_url = fs.readFileSync(
        process.env.NC_DATABASE_URL_FILE || process.env.DATABASE_URL_FILE,
        'utf-8'
      );
      process.env.NC_DB = this.extractXcUrlFromJdbc(database_url);
    } else if (process.env.NC_DATABASE_URL || process.env.DATABASE_URL) {
      process.env.NC_DB = this.extractXcUrlFromJdbc(
        process.env.NC_DATABASE_URL || process.env.DATABASE_URL
      );
    }
  }

  public static extractXcUrlFromJdbc(url: string) {
    const config = parseDbUrl(url);
    const port = config.port || defaultClientPortMapping[config.driver];
    const res = `${driverClientMapping[config.driver] || config.driver}://${
      config.host
    }${port ? `:${port}` : ''}?p=${config.password}&u=${config.user}&d=${
      config.database
    }`;
    if (config.search_path) {
      return `${res}&search_path=${config.search_path}`;
    }
    return res;
  }

  // public static initOneClickDeployment() {
  //   if (process.env.NC_ONE_CLICK) {
  //     const url = NcConfigFactory.extractXcUrlFromJdbc(process.env.DATABASE_URL);
  //     process.env.NC_DB = url;
  //   }
  // }
}

export { defaultConnectionConfig };

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
