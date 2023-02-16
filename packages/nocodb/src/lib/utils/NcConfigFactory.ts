import fs from 'fs';
import parseDbUrl from 'parse-database-url';
import { URL } from 'url';
import { promisify } from 'util';

import {
  AuthConfig,
  DbConfig,
  MailerConfig,
  NcConfig,
} from '../../interface/config';
import * as path from 'path';
import SqlClientFactory from '../db/sql-client/lib/SqlClientFactory';

const {
  uniqueNamesGenerator,
  starWars,
  adjectives,
  animals,
} = require('unique-names-generator');

const driverClientMapping = {
  mysql: 'mysql2',
  mariadb: 'mysql2',
  postgres: 'pg',
  postgresql: 'pg',
  sqlite: 'sqlite3',
  mssql: 'mssql',
};

const defaultClientPortMapping = {
  mysql: 3306,
  mysql2: 3306,
  postgres: 5432,
  pg: 5432,
  mssql: 1433,
};

const defaultConnectionConfig: any = {
  // https://github.com/knex/knex/issues/97
  // timezone: process.env.NC_TIMEZONE || 'UTC',
  dateStrings: true,
};

// default knex options
const defaultConnectionOptions = {
  pool: {
    min: 0,
    max: 10,
  },
};

const knownQueryParams = [
  {
    parameter: 'database',
    aliases: ['d', 'db'],
  },
  {
    parameter: 'password',
    aliases: ['p'],
  },
  {
    parameter: 'user',
    aliases: ['u'],
  },
  {
    parameter: 'title',
    aliases: ['t'],
  },
  {
    parameter: 'keyFilePath',
    aliases: [],
  },
  {
    parameter: 'certFilePath',
    aliases: [],
  },
  {
    parameter: 'caFilePath',
    aliases: [],
  },
  {
    parameter: 'ssl',
    aliases: [],
  },
  {
    parameter: 'options',
    aliases: ['opt', 'opts'],
  },
];

export default class NcConfigFactory implements NcConfig {
  public static async make(): Promise<NcConfig> {
    await this.jdbcToXcUrl();

    const ncConfig = new NcConfigFactory();

    ncConfig.auth = {
      jwt: {
        secret: process.env.NC_AUTH_JWT_SECRET,
      },
    };

    ncConfig.port = +(process?.env?.PORT ?? 8080);
    ncConfig.env = '_noco'; // process.env?.NODE_ENV || 'dev';
    ncConfig.workingEnv = '_noco'; // process.env?.NODE_ENV || 'dev';
    // ncConfig.toolDir = this.getToolDir();
    ncConfig.projectType =
      ncConfig?.envs?.[ncConfig.workingEnv]?.db?.[0]?.meta?.api?.type || 'rest';

    if (ncConfig.meta?.db?.connection?.filename) {
      ncConfig.meta.db.connection.filename = path.join(
        this.getToolDir(),
        ncConfig.meta.db.connection.filename
      );
    }

    if (process.env.NC_DB) {
      ncConfig.meta.db = await this.metaUrlToDbConfig(process.env.NC_DB);
    } else if (process.env.NC_DB_JSON) {
      ncConfig.meta.db = JSON.parse(process.env.NC_DB_JSON);
    } else if (process.env.NC_DB_JSON_FILE) {
      const filePath = process.env.NC_DB_JSON_FILE;

      if (!(await promisify(fs.exists)(filePath))) {
        throw new Error(`NC_DB_JSON_FILE not found: ${filePath}`);
      }

      const fileContent = await promisify(fs.readFile)(filePath, {
        encoding: 'utf8',
      });
      ncConfig.meta.db = JSON.parse(fileContent);
    }

    if (process.env.NC_TRY) {
      ncConfig.try = true;
      ncConfig.meta.db = {
        client: 'sqlite3',
        connection: ':memory:',
        pool: {
          min: 1,
          max: 1,
          // disposeTimeout: 360000*1000,
          idleTimeoutMillis: 360000 * 1000,
        },
      } as any;
    }

    if (process.env.NC_PUBLIC_URL) {
      ncConfig.envs['_noco'].publicUrl = process.env.NC_PUBLIC_URL;
      // ncConfig.envs[process.env.NODE_ENV || 'dev'].publicUrl = process.env.NC_PUBLIC_URL;
      ncConfig.publicUrl = process.env.NC_PUBLIC_URL;
    }

    if (process.env.NC_DASHBOARD_URL) {
      ncConfig.dashboardPath = process.env.NC_DASHBOARD_URL;
    }

    return ncConfig;
  }

  public static getToolDir() {
    return process.env.NC_TOOL_DIR || process.cwd();
  }

  public static hasDbUrl(): boolean {
    return Object.keys(process.env).some((envKey) =>
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
    key = '',
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
              url.searchParams.get('d') || url.searchParams.get('database'),
          },
          database:
            url.searchParams.get('d') || url.searchParams.get('database'),
        },
      } as any;
    } else {
      const parsedQuery = {};
      for (const [key, value] of url.searchParams.entries()) {
        const fnd = knownQueryParams.find(
          (param) => param.parameter === key || param.aliases.includes(key)
        );
        if (fnd) {
          parsedQuery[fnd.parameter] = value;
        } else {
          parsedQuery[key] = value;
        }
      }

      dbConfig = {
        client: url.protocol.replace(':', ''),
        connection: {
          ...defaultConnectionConfig,
          ...parsedQuery,
          host: url.hostname,
          port: +url.port,
        },
        // pool: {
        //   min: 1,
        //   max: 1
        // },
        acquireConnectionTimeout: 600000,
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
          caFilePath: url.searchParams.get('caFilePath'),
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
            'rest',
        },
        dbAlias: url.searchParams.get('dbAlias') || `db${key}`,
        metaTables: 'db',
        migrations: {
          disabled: false,
          name: 'nc_evolutions',
        },
      },
    });

    return dbConfig;
  }

  private static generateRandomTitle(): string {
    return uniqueNamesGenerator({
      dictionaries: [[starWars], [adjectives, animals]][
        Math.floor(Math.random() * 2)
      ],
    })
      .toLowerCase()
      .replace(/[ -]/g, '_');
  }

  static async metaUrlToDbConfig(urlString) {
    const url = new URL(urlString);

    let dbConfig;

    if (url.protocol.startsWith('sqlite3')) {
      const db = url.searchParams.get('d') || url.searchParams.get('database');
      dbConfig = {
        client: 'sqlite3',
        connection: {
          filename: db,
        },
        ...(db === ':memory:'
          ? {
              pool: {
                min: 1,
                max: 1,
                // disposeTimeout: 360000*1000,
                idleTimeoutMillis: 360000 * 1000,
              },
            }
          : {}),
      };
    } else {
      const parsedQuery = {};
      for (const [key, value] of url.searchParams.entries()) {
        const fnd = knownQueryParams.find(
          (param) => param.parameter === key || param.aliases.includes(key)
        );
        if (fnd) {
          parsedQuery[fnd.parameter] = value;
        } else {
          parsedQuery[key] = value;
        }
      }

      dbConfig = {
        client: url.protocol.replace(':', ''),
        connection: {
          ...defaultConnectionConfig,
          ...parsedQuery,
          host: url.hostname,
          port: +url.port,
        },
        acquireConnectionTimeout: 600000,
        ...(url.searchParams.has('search_path')
          ? {
              searchPath: url.searchParams.get('search_path').split(','),
            }
          : {}),
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
          'search_path',
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
        dbConfig.connection.ssl.ca = await promisify(fs.readFile)(
          dbConfig.connection.ssl.caFilePath
        ).toString();
      }
      if (dbConfig.connection.ssl.keyFilePath && !dbConfig.connection.ssl.key) {
        dbConfig.connection.ssl.key = await promisify(fs.readFile)(
          dbConfig.connection.ssl.keyFilePath
        ).toString();
      }
      if (
        dbConfig.connection.ssl.certFilePath &&
        !dbConfig.connection.ssl.cert
      ) {
        dbConfig.connection.ssl.cert = await promisify(fs.readFile)(
          dbConfig.connection.ssl.certFilePath
        ).toString();
      }
    }

    return dbConfig;
  }

  public static async makeProjectConfigFromUrl(
    url,
    type?: string
  ): Promise<NcConfig> {
    const config = new NcConfigFactory();
    const dbConfig = this.urlToDbConfig(url, '', config, type);
    // config.envs[process.env.NODE_ENV || 'dev'].db.push(dbConfig);
    config.envs['_noco'].db.push(dbConfig);

    if (process.env.NC_AUTH_ADMIN_SECRET) {
      config.auth = {
        masterKey: {
          secret: process.env.NC_AUTH_ADMIN_SECRET,
        },
      };
    } else if (process.env.NC_NO_AUTH) {
      config.auth = {
        disabled: true,
      };
      // } else if (config?.envs?.[process.env.NODE_ENV || 'dev']?.db?.[0]) {
    } else if (config?.envs?.['_noco']?.db?.[0]) {
      config.auth = {
        jwt: {
          // dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS || config.envs[process.env.NODE_ENV || 'dev'].db[0].meta.dbAlias,
          dbAlias:
            process.env.NC_AUTH_JWT_DB_ALIAS ||
            config.envs['_noco'].db[0].meta.dbAlias,
          secret: process.env.NC_AUTH_JWT_SECRET,
        },
      };
    }

    if (process.env.NC_DB) {
      config.meta.db = await this.metaUrlToDbConfig(process.env.NC_DB);
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
          idleTimeoutMillis: 360000 * 1000,
        },
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
            pass: process.env.NC_MAILER_PASS,
          },
        },
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

  public static async makeProjectConfigFromConnection(
    dbConnectionConfig: any,
    type?: string
  ): Promise<NcConfig> {
    const config = new NcConfigFactory();
    let dbConfig = dbConnectionConfig;

    if (dbConfig.client === 'sqlite3') {
      dbConfig = {
        client: 'sqlite3',
        connection: {
          ...dbConnectionConfig,
          database: dbConnectionConfig.connection.filename,
        },
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
          type: type || 'rest',
        },
        dbAlias: `db${key}`,
        metaTables: 'db',
        migrations: {
          disabled: false,
          name: 'nc_evolutions',
        },
      },
    });

    // config.envs[process.env.NODE_ENV || 'dev'].db.push(dbConfig);
    config.envs['_noco'].db.push(dbConfig);

    if (process.env.NC_AUTH_ADMIN_SECRET) {
      config.auth = {
        masterKey: {
          secret: process.env.NC_AUTH_ADMIN_SECRET,
        },
      };
    } else if (process.env.NC_NO_AUTH) {
      config.auth = {
        disabled: true,
      };
      // } else if (config?.envs?.[process.env.NODE_ENV || 'dev']?.db?.[0]) {
    } else if (config?.envs?.['_noco']?.db?.[0]) {
      config.auth = {
        jwt: {
          // dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS || config.envs[process.env.NODE_ENV || 'dev'].db[0].meta.dbAlias,
          dbAlias:
            process.env.NC_AUTH_JWT_DB_ALIAS ||
            config.envs['_noco'].db[0].meta.dbAlias,
          secret: process.env.NC_AUTH_JWT_SECRET,
        },
      };
    }

    if (process.env.NC_DB) {
      config.meta.db = await this.metaUrlToDbConfig(process.env.NC_DB);
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
          idleTimeoutMillis: 360000 * 1000,
        },
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
      const metaSqlClient = await SqlClientFactory.create({
        ...args.meta.db,
        connection: args.meta.db,
      });
      await metaSqlClient.createDatabaseIfNotExists({
        database: args.meta.db?.connection?.filename,
      });
    } else {
      const metaSqlClient = await SqlClientFactory.create(args.meta.db);
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
      },
    },
  };
  public mailer: MailerConfig;
  public try = false;

  public dashboardPath = '/dashboard';

  constructor() {
    this.envs = { _noco: { db: [] } };
  }

  public static async jdbcToXcUrl() {
    if (process.env.NC_DATABASE_URL_FILE || process.env.DATABASE_URL_FILE) {
      const database_url = await promisify(fs.readFile)(
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

  public static extractXcUrlFromJdbc(url: string, rtConfig = false) {
    // drop the jdbc prefix
    if (url.startsWith('jdbc:')) {
      url = url.substring(5);
    }

    const config = parseDbUrl(url);

    const parsedConfig: {
      driver?: string;
      host?: string;
      port?: string;
      database?: string;
      user?: string;
      password?: string;
      ssl?: string;
    } = {};
    for (const [key, value] of Object.entries(config)) {
      const fnd = knownQueryParams.find(
        (param) => param.parameter === key || param.aliases.includes(key)
      );
      if (fnd) {
        parsedConfig[fnd.parameter] = value;
      } else {
        parsedConfig[key] = value;
      }
    }

    if (!parsedConfig?.port)
      parsedConfig.port =
        defaultClientPortMapping[
          driverClientMapping[parsedConfig.driver] || parsedConfig.driver
        ];

    if (rtConfig) {
      const { driver, ...connectionConfig } = parsedConfig;

      const client = driverClientMapping[driver] || driver;

      const avoidSSL = [
        'localhost',
        '127.0.0.1',
        'host.docker.internal',
        '172.17.0.1',
      ];

      if (
        client === 'pg' &&
        !connectionConfig?.ssl &&
        !avoidSSL.includes(connectionConfig.host)
      ) {
        connectionConfig.ssl = 'true';
      }

      return {
        client: client,
        connection: {
          ...connectionConfig,
        },
      } as any;
    }

    const { driver, host, port, database, user, password, ...extra } =
      parsedConfig;

    const extraParams = [];

    for (const [key, value] of Object.entries(extra)) {
      extraParams.push(`${key}=${value}`);
    }

    const res = `${driverClientMapping[driver] || driver}://${host}${
      port ? `:${port}` : ''
    }?${user ? `u=${user}&` : ''}${password ? `p=${password}&` : ''}${
      database ? `d=${database}&` : ''
    }${extraParams.join('&')}`;

    return res;
  }

  // public static initOneClickDeployment() {
  //   if (process.env.NC_ONE_CLICK) {
  //     const url = NcConfigFactory.extractXcUrlFromJdbc(process.env.DATABASE_URL);
  //     process.env.NC_DB = url;
  //   }
  // }
}

export { defaultConnectionConfig, defaultConnectionOptions };
