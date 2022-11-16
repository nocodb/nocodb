import chalkPipe from 'chalk-pipe';
import download from 'download-git-repo';
import inquirer from 'inquirer';
import mkdirp from 'mkdirp';
import path from 'path';
import tcpPortUsed from 'tcp-port-used';
import URL from 'url';
import { promisify } from 'util';
import Util from '../util/Util';

import boxen from 'boxen';
import * as fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import Lang, { STR } from '../util/Lang';

// @ts-ignore
const colors = require('colors');

const dbDefaults = {
  sqlite3: {
    host: 'localhost',
    port: '1433',
    username: 'sa',
    password: '',
    database: ''
  },
  mysql2: {
    host: 'localhost',
    port: '3306',
    username: 'root',
    password: '',
    database: ''
  },
  pg: {
    host: 'localhost',
    port: '5432',
    username: 'postgres',
    password: '',
    database: ''
  },
  mssql: {
    host: 'localhost',
    port: '1433',
    username: 'sa',
    password: '',
    database: ''
  }
};

// const apiTypeMapping = {
//   'GRAPHQL APIs': 'graphql',
//   'REST APIs': 'rest',
//   'gRPC APIs': 'grpc'
// }
// const languageMapping = {
//   'Javascript': 'js',
//   'Typescript': 'ts',
// }

class NewMgr {
  /**
   *
   * Does the below :
   * - Get database input and make a DB URL from it.
   * - Create new folder and 'cd' to that folder.
   * - Return true/success
   * - Else failure
   *
   * @param args
   * @returns {Promise<string|string|boolean|*>}
   */
  public static async getNewProjectInput(args): Promise<any> {
    if (args._.length < 2) {
      const usage = '\n$ xc new project_name'.green.bold;
      console.log(
        `\n\nWarning! missing project name\n\nExample Usage:\n${usage}\n`.red
          .bold
      );
      return false;
    }

    /* Construct database URL from prompt */
    const dbTypes = Object.keys(dbDefaults);
    args.url = [];

    console.log(
      `NocoDB requires a database to store metadata of database-spreadsheets.\nPlease enter the database credentials (defaults to SQLite3)`
        .green.bold
    );
    const answers = await inquirer.prompt([
      {
        name: 'type',
        type: 'list',
        message: Lang.getString(STR.DB_TYPE), // '🔥 Choose SQL Database type\t:',
        choices: dbTypes.map(t => ({
          name: t,
          value: t,
          short: t.green.bold
        })),
        default: 'sqlite3',
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        }
      },
      {
        name: 'host',
        type: 'input',
        message: Lang.getString(STR.DB_HOST), // '👉 Enter database host name\t:',
        default(ans) {
          return dbDefaults[ans.type].host;
        },
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'port',
        type: 'number',
        message: Lang.getString(STR.DB_PORT), // '👉 Enter database port number\t:',
        default(ans) {
          return dbDefaults[ans.type].port;
        },
        transformer(color) {
          try {
            return color.green.bold;
          } catch (e) {
            return color;
          }
        },
        validate(port, answers) {
          const done = this.async();
          if (
            answers.host === 'host.docker.internal' ||
            answers.host === 'docker.for.win.localhost'
          ) {
            done(null, true);
          } else {
            NewMgr.isPortOpen(answers.host, port)
              .then(isOpen => {
                if (isOpen) {
                  done(null, true);
                } else {
                  // done('Port is not open')
                  console.log(
                    `\n\n😩 ${answers.host}:${port} is not open please start the database if you haven't\n`
                      .red.bold
                  );
                  process.exit(0);
                }
              })
              .catch(done);
          }
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'username',
        type: 'input',
        message: Lang.getString(STR.DB_USER), // '👉 Enter database username\t:',
        default(ans) {
          return dbDefaults[ans.type].username;
        },
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'password',
        type: 'input',
        mask: true,
        message: Lang.getString(STR.DB_PASSWORD), // '🙈 Enter database password\t:',
        transformer(color) {
          return new Array(color.length).fill('*'.green.bold).join('');
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'database',
        type: 'input',
        default(_ans) {
          return args._[1] + '_dev';
        },
        message: Lang.getString(STR.DB_SCHEMA), // '👉 Enter database/schema name\t:',
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },

      {
        name: 'projectType',
        type: 'list',
        message: Lang.getString(STR.PROJECT_TYPE), // '🚀 How do you want to run it\t:',
        choices: [
          'As Node.js Project',
          'As Docker' // 'Try XC Instant App (Without scaffolding code)'
        ].map(t => ({
          name: t,
          value: t,
          short: t.green.bold
        })),
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        }
      }
    ]);

    /* if not valid retry getting right input */
    if (answers.type !== 'sqlite3' && !answers.database) {
      console.log(
        '\n\tWarning! Database name can NOT be empty. Retry.\n '.red.bold
      );
      this.getNewProjectInput(args);
    }

    switch (answers.projectType) {
      case 'As Docker':
        answers.projectType = 'docker';
        break;
      case 'As Node.js Project':
        answers.projectType = 'mvc';
        break;
      default:
        answers.projectType = 'docker';
        break;
    }

    if (answers.projectType === 'mvc' && !answers.isForExisting) {
      /* attach new project name to path and 'cd' to that folder */
      args.folder = path.join(args.folder, args._[1]);
      mkdirp.sync(args.folder);
      process.chdir(args.folder);
      await Util.runCmd(`cd ${Util.escapeShellArg(args.folder)}`);
      await promisify(download)(
        'direct:https://github.com/nocodb/nocodb-seed/archive/refs/heads/main.zip',
        args.folder
      );

      if (answers.type !== 'sqlite3') {
        fs.appendFileSync(
          path.join(args.folder, '.env'),
          `NC_DB=${answers.type}://${answers.host}:${answers.port}?u=${answers.username}&p=${answers.password}&d=${answers.database}`
        );
      }

      if (os.type() === 'Windows_NT') {
        console.log(
          boxen(
            `# Project created successfully\n\n# Please run the following commands\n\n${
              (
                'cd ' +
                Util.escapeShellArg(args.folder) +
                '\nnpm install  \nnpm start\n'
              ).green.bold
            }`,
            {
              borderColor: 'green',
              borderStyle: 'round',
              margin: 1,
              padding: 1
            } as any
          )
        );
      } else {
        await Util.runCmd(`npm install; npm run start;`);
      }
    } else if (answers.projectType) {
      let env = '';
      if (answers.type !== 'sqlite3') {
        env = `--env NC_DB="${answers.type}://${answers.host}:${answers.port}?u=${answers.username}&p=${answers.password}&d=${answers.database}"`;
      }
      const linuxHost = os.type() === 'Linux' ? '--net=host' : '';
      if (os.type() === 'Windows_NT') {
        // tslint:disable-next-line:ban-comma-operator
        console.log(
          boxen(
            `# Please run the following docker commands\n\n${
              `docker run -p 8080:8080 ${linuxHost} -d ${env} nocodb/nocodb:latest`
                .green.bold
            }\n`,
            {
              borderColor: 'green',
              borderStyle: 'round',
              margin: 1,
              padding: 1
            } as any
          )
        );
      } else {
        await Util.runCmd(
          `docker run -p 8080:8080 ${linuxHost} -d ${env} nocodb/nocodb:latest`
        );
      }
    }
  }

  public static async getNewProjectInputOld(args): Promise<any> {
    if (args._.length < 2) {
      const usage = '\n$ xc new project_name'.green.bold;
      console.log(
        `\n\nWarning! missing project name\n\nExample Usage:\n${usage}\n`.red
          .bold
      );
      return false;
    }

    /* Construct database URL from prompt */
    const dbTypes = Object.keys(dbDefaults);
    args.url = [];

    const answers = await inquirer.prompt([
      {
        name: 'type',
        type: 'list',
        message: Lang.getString(STR.DB_TYPE), // '🔥 Choose SQL Database type\t:',
        choices: dbTypes.map(t => ({
          name: t,
          value: t,
          short: t.green.bold
        })),
        default: 'mysql2',
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        }
      },
      {
        name: 'host',
        type: 'input',
        message: Lang.getString(STR.DB_HOST), // '👉 Enter database host name\t:',
        default(ans) {
          return dbDefaults[ans.type].host;
        },
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'port',
        type: 'number',
        message: Lang.getString(STR.DB_PORT), // '👉 Enter database port number\t:',
        default(ans) {
          return dbDefaults[ans.type].port;
        },
        transformer(color) {
          try {
            return color.green.bold;
          } catch (e) {
            return color;
          }
        },
        validate(port, answers) {
          const done = this.async();
          if (
            answers.host === 'host.docker.internal' ||
            answers.host === 'docker.for.win.localhost'
          ) {
            done(null, true);
          } else {
            NewMgr.isPortOpen(answers.host, port)
              .then(isOpen => {
                if (isOpen) {
                  done(null, true);
                } else {
                  // done('Port is not open')
                  console.log(
                    `\n\n😩 ${answers.host}:${port} is not open please start the database if you haven't\n`
                      .red.bold
                  );
                  process.exit(0);
                }
              })
              .catch(done);
          }
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'username',
        type: 'input',
        message: Lang.getString(STR.DB_USER), // '👉 Enter database username\t:',
        default(ans) {
          return dbDefaults[ans.type].username;
        },
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'password',
        type: 'input',
        mask: true,
        message: Lang.getString(STR.DB_PASSWORD), // '🙈 Enter database password\t:',
        transformer(color) {
          return new Array(color.length).fill('*'.green.bold).join('');
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'database',
        type: 'input',
        default(_ans) {
          return args._[1] + '_dev';
        },
        message: Lang.getString(STR.DB_SCHEMA), // '👉 Enter database/schema name\t:',
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'apiType',
        type: 'list',
        message: Lang.getString(STR.DB_API), // '🚀 Enter API type to generate\t:',
        choices: ['REST APIs', 'GRAPHQL APIs', 'gRPC APIs'].map(t => ({
          name: t,
          value: t,
          short: t.green.bold
        })),
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      },
      {
        name: 'projectType',
        type: 'list',
        message: Lang.getString(STR.PROJECT_TYPE), // '🚀 How do you want to run it\t:',
        choices: [
          'Docker',
          'New Node.js project',
          'Existing Node.js project',
          'Try XC Instant App (Without scaffolding code)'
        ].map(t => ({
          name: t,
          value: t,
          short: t.green.bold
        })),
        transformer(color) {
          return chalkPipe(color)(color.green.bold);
        },
        when({ type }) {
          return type !== 'sqlite3';
        }
      }
      // {
      //   name: 'programmingLanguage',
      //   type: 'list',
      //   message: '🚀 Enter preferred programming language\t:',
      //   choices: ['Javascript', 'Typescript'].map(t => ({
      //     name: t,
      //     value: t,
      //     short: t.green.bold
      //   })),
      //   transformer(color) {
      //     return chalkPipe(color)(color.green.bold);
      //   },
      //   when({type}) {
      //     return type !== 'sqlite3'
      //   }
      // }
    ]);

    // console.log(answers);

    if (answers.type === 'sqlite3') {
      console.log('Please use desktop app to create Sqlite project'.green.bold);
      process.exit(0);
    }

    /* if not valid retry getting right input */
    if (!answers.database) {
      console.log(
        '\n\tWarning! Database name can NOT be empty. Retry.\n '.red.bold
      );
      this.getNewProjectInput(args);
    }
    //

    /* prepare the args */
    // const url = `${answers.type}://${answers.host}:${answers.port}?u=${answers.username}&p=${answers.password}&d=${answers.database}&api=${apiTypeMapping[answers.projectType]}`;
    // args._[0] = answers.projectType === 'REST APIs' ? 'gar' : 'gag';
    switch (answers.apiType) {
      case 'REST APIs':
        answers.apiType = 'rest';
        break;
      case 'GRAPHQL APIs':
        answers.apiType = 'graphql';
        break;
      case 'gRPC APIs':
        answers.apiType = 'grpc';
        break;
      default:
        answers.apiType = 'rest';
        break;
    }

    switch (answers.projectType) {
      case 'Docker':
        answers.projectType = 'docker';
        break;
      case 'New Node.js project':
        answers.projectType = 'mvc';
        break;
      case 'Existing Node.js project':
        answers.projectType = 'mvc';
        answers.isForExisting = true;
        break;
      default:
        answers.projectType = 'docker';
        break;
    }

    if (answers.projectType === 'mvc' && !answers.isForExisting) {
      /* attach new project name to path and 'cd' to that folder */
      args.folder = path.join(args.folder, args._[1]);
      mkdirp.sync(args.folder);
      process.chdir(args.folder);
      await Util.runCmd(`cd ${Util.escapeShellArg(args.folder)}`);

      await promisify(download)('gitlab:xc-public/test10', args.folder);
      const config = {
        title: args._[1],
        version: '0.6',
        envs: {
          dev: {
            db: [
              {
                client: answers.type,
                connection: {
                  host: answers.host,
                  port: answers.port,
                  user: answers.username,
                  password: answers.password,
                  database: answers.database,
                  multipleStatements: true
                },
                meta: {
                  tn: 'xc_evolutions',
                  dbAlias: 'db',
                  api: {
                    type: answers.apiType,
                    prefix: '',
                    graphqlDepthLimit: 10
                  },
                  inflection: {
                    tn: 'none',
                    cn: 'none'
                  }
                }
              }
            ],
            apiClient: {
              data: []
            }
          }
        },
        workingEnv: 'dev',
        seedsFolder: 'seeds',
        queriesFolder: 'queries',
        apisFolder: 'apis',
        projectType: answers.apiType,
        type: 'docker',
        language: 'ts',
        apiClient: {
          data: []
        },
        auth: {
          jwt: {
            secret: uuidv4(),
            dbAlias: 'db'
          }
        },
        meta: {
          db: {
            client: 'sqlite3',
            connection: {
              filename: 'xc.db'
            }
          }
        }
      };

      fs.writeFileSync(
        path.join(args.folder, 'config.xc.json'),
        JSON.stringify(config, null, 2)
      );

      await Util.runCmd(`npm install; npm run start;`);
    } else if (answers.projectType === 'mvc') {
      console.log(`
1. Install our npm package using following command

\t${`npm install --save nocodb`.green}
      
2. Add the following code in your existing express project

\t${
        `const {Noco} = require("nocodb");

\tnew Noco({
        title: "${args._[1]}",
        "version": "0.6",
        "envs": {
          "dev": {
            "db": [
              {
                "client": "${answers.type}",
                "connection": {
                  "host": "${answers.host}",
                  "port": "${answers.port}",
                  "user": "${answers.username}",
                  "password": "${answers.password}",
                  "database": "${answers.database}",
                  "multipleStatements": true
                },
                "meta": {
                  "tn": "xc_evolutions",
                  "dbAlias": "db",
                  "api": {
                    "type": "${answers.apiType}",
                    "prefix": "",
                    "graphqlDepthLimit": 10
                  },
                  "inflection": {
                    "tn": "none",
                    "cn": "none"
                  }
                }
              }
            ],
            "apiClient": {
              "data": []
            }
          }
        },
        "workingEnv": "dev",
        "seedsFolder": "seeds",
        "queriesFolder": "queries",
        "apisFolder": "apis",
        "projectType": "${answers.apiType}",
        "type": "docker",
        "language": "ts",
        "apiClient": {
          "data": []
        },
        "auth": {
          "jwt": {
            "secret": "${uuidv4()}",
            "dbAlias": "db"
          }
        },
        "meta":{   
          "db": {
            "client": "sqlite3",
            "connection": {
              "filename": "xc.db"
            }
          }
        }
      }).init().then(mw => app.use(mw))`.green
      }



${`Note: ${'app'.bold} - refers to your express server instance`}



`);
    } else if (answers.projectType === 'docker') {
      const dbUrl = `${answers.type}://${answers.host}:${answers.port}?u=${answers.username}&p=${answers.password}&d=${answers.database}`;
      //       console.log(`
      // You can create docker container using following command
      //
      // \t${`docker run -p 8080:8080 -p 8081:8081 -p 8082:8082 -d --name xc-instant --env DB_URL=${dbUrl} -d xgenecloud/xc:latest`.green}
      //
      //
      // Then visit http://localhost:8080/xc to access the Dashboard
      //
      // `)

      const linuxHost = os.type() === 'Linux' ? '--net=host' : '';

      await Util.runCmd(
        `docker run -p 8080:8080 -p 8081:8081 -p 8082:8082 ${linuxHost} --name xc-instant --env NC_DB_URL="${dbUrl}" xgenecloud/xc:latest`
      );
    }
    // args.url.push(url);
    //
    // args.language = languageMapping[answers.programmingLanguage];

    // return OldNewMgr.testConnection(args)
  }

  public static async testConnection({ url }) {
    for (const u of url) {
      const parsedUrlData = URL.parse(u, true);
      const queryParams = parsedUrlData.query;
      const client = parsedUrlData.protocol.slice(0, -1);
      const config = {
        client,
        connection: {
          host: parsedUrlData.hostname,
          port: +parsedUrlData.port,
          user: queryParams.u,
          password: queryParams.p,
          database:
            client === 'pg' ? 'postgres' : client === 'mssql' ? undefined : null
        }
      };

      try {
        const knex = require('knex')(config);
        await knex.raw('SELECT 1+1 as data');
      } catch (e) {
        console.log(`\n😩 Test connection failed for : ${url}\n`.red.bold);
        return false;
      }
    }
    return true;
  }

  public static async isPortOpen(host, port) {
    try {
      return await tcpPortUsed.check(+port, host);
    } catch (e) {
      console.log(e);
      console.log(
        `\n😩 ${host}:${port} is not reachable please check\n`.red.bold
      );
      return true;
    }
  }

  public static async initProject(_args: any): Promise<void> {
    await promisify(download)('gitlab:xc-public/test10', process.cwd());
    await Util.runCmd(`npm install; npm run start;`);
  }
}

export default NewMgr;
