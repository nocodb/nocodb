import chalkPipe from 'chalk-pipe';
import inquirer from 'inquirer';
import path from 'path';
import tcpPortUsed from 'tcp-port-used';
import URL from 'url';
import Lang, { STR } from '../util/Lang';
import Util from '../util/Util';

import('colors');

const dbDefaults = {
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
  },
  sqlite3: {
    host: 'localhost',
    port: '1433',
    username: 'sa',
    password: '',
    database: ''
  }
};

class TryMgr {
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
  public static async getProjectInput(args): Promise<any> {
    let dbUrl;

    if (args._[0] !== 't' && args._[0] !== 'try') {
      if (args._[1] === 'rest') {
        dbUrl = `sqlite3://sqlite3?d=${path.join(__dirname, 'sakila.db')}`;
      } else if (args._[1] === 'gql') {
        dbUrl = `sqlite3://sqlite3?d=${path.join(
          __dirname,
          'sakila.db'
        )}&api=graphql`;
      }
    } else {
      /* Construct database URL from prompt */
      const dbTypes = Object.keys(dbDefaults);
      args.url = [];

      const finalAnswers = await inquirer.prompt([
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
              TryMgr.isPortOpen(answers.host, port)
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
        }
      ]);

      // console.log(finalAnswers);

      if (finalAnswers.type === 'sqlite3') {
        console.log(
          'Please use desktop app to create Sqlite project'.green.bold
        );
        process.exit(0);
      }

      /* if not valid retry getting right input */
      /*    if (!finalAnswers.database) {
            console.log('\n\tWarning! Database name can NOT be empty. Retry.\n '.red.bold);
            this.getNewProjectInput(args);
          }*/
      //

      /* prepare the args */
      // const url = `${finalAnswers.type}://${finalAnswers.host}:${finalAnswers.port}?u=${finalAnswers.username}&p=${finalAnswers.password}&d=${finalAnswers.database}&api=${apiTypeMapping[finalAnswers.projectType]}`;
      // args._[0] = finalAnswers.projectType === 'REST APIs' ? 'gar' : 'gag';
      switch (finalAnswers.apiType) {
        case 'REST APIs':
          finalAnswers.apiType = 'rest';
          break;
        case 'GRAPHQL APIs':
          finalAnswers.apiType = 'graphql';
          break;
        case 'gRPC APIs':
          finalAnswers.apiType = 'grpc';
          break;
        default:
          finalAnswers.apiType = 'rest';
          break;
      }
      dbUrl = `${finalAnswers.type}://${finalAnswers.host}:${finalAnswers.port}?u=${finalAnswers.username}&p=${finalAnswers.password}&d=${finalAnswers.database}&api=${finalAnswers.apiType}`;
    }
    // await Util.runCmd(`cd ${__dirname};echo "const {XcTry} = require('xc-instant'); process.env.NC_DB_URL='${finalAnswers.dbUrl}'; XcTry().then(() => console.log('App started'));" | node`);
    await Util.runCmd(
      `echo "const {XcTry} = require('xc-instant'); XcTry('${dbUrl}').then(() => console.log('App started'));" | NODE_PATH=${path.join(
        __dirname,
        '..',
        'node_modules'
      )} node`
    );
  }

  public static async testConnection({ url }) {
    for (const u of url) {
      const parsedUrlData = URL.parse(u, true);
      const queryParams = parsedUrlData.query;
      const client = parsedUrlData.protocol.slice(0, -1);
      const config = {
        client,
        connection: {
          database:
            client === 'pg'
              ? 'postgres'
              : client === 'mssql'
              ? undefined
              : null,
          host: parsedUrlData.hostname,
          password: queryParams.p,
          port: +parsedUrlData.port,
          user: queryParams.u
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
}

export default TryMgr;
