import fs from 'fs';
import path from 'path';

// const {uniqueNamesGenerator, starWars, adjectives, animals} = require('unique-names-generator');

export default class NcConfigFactory {


  static make() {
    const config: any = new NcConfigFactory();

    const dbUrls = Object.keys(process.env).filter(envKey => envKey.startsWith('NC_DB_URL'));

    for (const key of dbUrls.sort()) {
      const dbConfig = this.urlToDbConfig(process.env[key], key.slice(9), config);
      config.envs[process.env.NODE_ENV || 'dev'].db.push(dbConfig);
    }


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
    } else if (config.envs[process.env.NODE_ENV || 'dev'].db[0]) {
      config.auth = {
        jwt: {
          dbAlias: process.env.NC_AUTH_JWT_DB_ALIAS || config.envs[process.env.NODE_ENV || 'dev'].db[0].meta.dbAlias,
          secret: process.env.NC_AUTH_JWT_SECRET || 'sdjhjdhkshdkjhskdkjshk' // uuidv4()
        }
      };
    }


    if (process.env.NC_DB) {
      config.meta.db = this.metaUrlToDbConfig(process.env.NC_DB)
    }

    config.port = +(process.env.PORT || 8080);
    config.env = process.env.NODE_ENV || 'dev';
    config.workingEnv = process.env.NODE_ENV || 'dev';
    config.folder = config.toolDir = process.env.NC_TOOL_DIR || process.cwd();


    return config;
  }

  static hasDbUrl() {
    return Object.keys(process.env).some(envKey => envKey.startsWith('NC_DB_URL'));
  }

  static makeFromUrls(urls) {
    const config: any = new NcConfigFactory();

    config.envs[process.env.NODE_ENV || 'dev'].db = [];
    for (const [i, url] of Object.entries(urls)) {
      config.envs[process.env.NODE_ENV || 'dev'].db.push(this.urlToDbConfig(url, i));
    }

    return config;
  }


  static urlToDbConfig(urlString, key, config?) {
    const url = new URL(urlString);

    let dbConfig;

    if (url.protocol.startsWith('sqlite3')) {
      dbConfig = {
        client: 'sqlite3',
        "connection": {
          "client": "sqlite3",
          "connection": {
            "filename": url.searchParams.get('d') || url.searchParams.get('database')
          },
          "database": url.searchParams.get('d') || url.searchParams.get('database'),
          "useNullAsDefault": true
        },
      };
    } else {
      dbConfig = {
        client: url.protocol.replace(':', ''),
        "connection": {
          database: url.searchParams.get('d') || url.searchParams.get('database'),
          "host": url.hostname,
          "password": url.searchParams.get('p') || url.searchParams.get('password'),
          "port": +url.port,
          'user': url.searchParams.get('u') || url.searchParams.get('user'),
        },
        pool: {
          min: 5,
          max: 50
        },
        acquireConnectionTimeout: 600000,
      };
      if (url.searchParams.get('keyFilePath') && url.searchParams.get('certFilePath') && url.searchParams.get('caFilePath')) {
        dbConfig.connection.ssl = {
          keyFilePath: url.searchParams.get('keyFilePath'),
          certFilePath: url.searchParams.get('certFilePath'),
          caFilePath: url.searchParams.get('caFilePath'),
        }
      }
    }

    if (config && !config.title) {
      config.title = url.searchParams.get('t') || url.searchParams.get('title') || this.generateRandomTitle();
    }

    Object.assign(dbConfig, {
      meta: {
        tn: 'nc_evolutions',
        allSchemas: !!url.searchParams.get('allSchemas') || !(url.searchParams.get('d') || url.searchParams.get('database')),
        api: {
          prefix: url.searchParams.get('apiPrefix') || '',
          swagger: true,
          type: url.searchParams.get('api') || url.searchParams.get('a') || "rest",
        },
        dbAlias: url.searchParams.get('dbAlias') || `db${key}`,
        metaTables: 'db',
        migrations: {
          disabled: false,
          name: "nc_evolutions"
        }
      }
    })


    return dbConfig;
  }

  static generateRandomTitle() {
    return 'test'
    // return uniqueNamesGenerator({
    //   dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)]
    // }).toLowerCase().replace(/[ -]/g, '_');
  }

  static metaUrlToDbConfig(urlString) {
    const url = new URL(urlString);

    let dbConfig;

    if (url.protocol.startsWith('sqlite3')) {
      dbConfig = {
        "client": "sqlite3",
        "connection": {
          "filename": url.searchParams.get('d') || url.searchParams.get('database')
        }
      }
    } else {
      dbConfig = {
        client: url.protocol.replace(':', ''),
        "connection": {
          database: url.searchParams.get('d') || url.searchParams.get('database'),
          "host": url.hostname,
          "password": url.searchParams.get('p') || url.searchParams.get('password'),
          "port": +url.port,
          'user': url.searchParams.get('u') || url.searchParams.get('user'),
        },
        pool: {
          min: 5,
          max: 50
        },
        acquireConnectionTimeout: 600000,
      };

    }
    return dbConfig
  }


  static metaDbCreateIfNotExist(args) {
    const dbPath = path.join(args.toolDir, 'noco.db')
    const exists = fs.existsSync(dbPath);
    if (!exists) {
      const fd = fs.openSync(dbPath, "w");
      fs.closeSync(fd);
    }
  }

  // version = '0.6';
  // port;
  // auth;
  // env;
  // workingEnv;
  // toolDir;
  // envs;
  // queriesFolder;
  // seedsFolder;
  // title;
  // meta = {
  //   "db": {
  //     "client": "sqlite3",
  //     "connection": {
  //       "filename": "xc.db"
  //     }
  //   }
  // }

  //@ts-ignore
  private envs: any;

  constructor() {

    this.envs = {dev: {db: []}};
  }

}

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
