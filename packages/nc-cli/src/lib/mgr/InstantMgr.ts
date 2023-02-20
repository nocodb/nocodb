// import chalkPipe from 'chalk-pipe';
// import inquirer from 'inquirer';
// import mkdirp from 'mkdirp';
// import path from 'path';
// import URL from 'url';
import express from 'express';
import { XcApis, XcConfigFactory } from 'xc-instant';

import('colors');

// import tcpPortUsed from 'tcp-port-used';

// const dbDefaults = {
//   mysql: {
//     host: 'localhost',
//     port: '3306',
//     username: 'root',
//     password: '',
//     database: ''
//   },
//   pg: {
//     host: 'localhost',
//     port: '5432',
//     username: 'postgres',
//     password: '',
//     database: ''
//   },
//   mssql: {
//     host: 'localhost',
//     port: '1433',
//     username: 'sa',
//     password: '',
//     database: ''
//   },
//   sqlite3: {
//     host: 'localhost',
//     port: '1433',
//     username: 'sa',
//     password: '',
//     database: ''
//   },
// };

class InstantMgr {
  public static async getNewProjectInput(args): Promise<any> {
    if (args._.length < 2) {
      const usage = '\n$ xc instant "mysql://localhost:3306?u=root&p=password&d=database&a=rest"'
        .green.bold;
      console.log(
        `\n\nWarning! missing connection URL\n\nExample Usage:\n${usage}\n`.red
          .bold
      );
      return false;
    }

    const config = XcConfigFactory.makeFromUrls(args._.slice(1));

    const server = express();

    server.set('view engine', 'ejs');
    const app = new XcApis(config);

    server.use(await app.init());

    server.listen('8080', () => console.log('App started'));

    // /* Construct database URL from prompt */
    // const dbTypes = Object.keys(dbDefaults);
    // args.url = []
    //
    // const answers = await inquirer
    //   .prompt([
    //     {
    //       name: 'type',
    //       type: 'list',
    //       message: '🔥 Choose SQL Database type\t:',
    //       choices: dbTypes.map(t => ({
    //         name: t,
    //         value: t,
    //         short: t.green.bold
    //       })),
    //       default: 'mysql',
    //       transformer (color) {
    //         return chalkPipe(color)(color.green.bold);
    //       }
    //     },
    //     {
    //       name: 'host',
    //       type: 'input',
    //       message: '👉 Enter database host name\t:',
    //       default(ans) {
    //         return dbDefaults[ans.type].host
    //       },
    //       transformer (color) {
    //         return chalkPipe(color)(color.green.bold);
    //       },
    //       when({type}) {
    //         return type !== 'sqlite3'
    //       }
    //     },
    //     {
    //       name: 'port',
    //       type: 'number',
    //       message: '👉 Enter database port number\t:',
    //       default(ans) {
    //         return dbDefaults[ans.type].port
    //       },
    //       transformer (color) {
    //         try {
    //           return color.green.bold;
    //         } catch (e) {
    //           return color
    //         }
    //       },
    //       validate (port, answers) {
    //         let done = this.async();
    //         NewMgr.isPortOpen(answers.host, port).then(isOpen => {
    //           if (isOpen) {
    //             done(null, true)
    //           } else {
    //             // done('Port is not open')
    //             console.log(`\n\n😩 ${answers.host}:${port} is not open please start the database if you haven't\n`.red.bold)
    //             process.exit(0);
    //           }
    //         }).catch(done)
    //       },
    //       when({type}) {
    //         return type !== 'sqlite3'
    //       }
    //     },
    //     {
    //       name: 'username',
    //       type: 'input',
    //       message: '👉 Enter database username\t:',
    //       default(ans) {
    //         return dbDefaults[ans.type].username
    //       },
    //       transformer (color) {
    //         return chalkPipe(color)(color.green.bold);
    //       },
    //       when({type}) {
    //         return type !== 'sqlite3'
    //       }
    //     },
    //     {
    //       name: 'password',
    //       type: 'input',
    //       mask: true,
    //       message: '🙈 Enter database password\t:',
    //       transformer (color) {
    //         return new Array(color.length).fill('*'.green.bold).join('')
    //       },
    //       when({type}) {
    //         return type !== 'sqlite3'
    //       }
    //     },
    //     {
    //       name: 'database',
    //       type: 'input',
    //       default(_ans) {
    //         return args._[1] + '_dev';
    //       },
    //       message: '👉 Enter database/schema name\t:',
    //       transformer (color) {
    //         return chalkPipe(color)(color.green.bold);
    //       },
    //       when({type}) {
    //         return type !== 'sqlite3'
    //       }
    //     },
    //     {
    //       name: 'projectType',
    //       type: 'list',
    //       message: '🚀 Enter API type to generate\t:',
    //       choices: ['REST APIs', 'GRAPHQL APIs'].map(t => ({
    //         name: t,
    //         value: t,
    //         short: t.green.bold
    //       })),
    //       transformer (color) {
    //         return chalkPipe(color)(color.green.bold);
    //       },
    //       when({type}) {
    //         return type !== 'sqlite3'
    //       }
    //     }
    //   ])
    //
    // // console.log(answers);
    //
    // if (answers.type === 'sqlite3') {
    //   console.log('Please use desktop app to create Sqlite project'.green.bold)
    //   process.exit(0);
    // }
    //
    // /* if not valid retry getting right input */
    // if (!answers.database) {
    //   console.log('\n\tWarning! Database name can NOT be empty. Retry.\n '.red.bold);
    //   this.getNewProjectInput(args);
    // }
    //
    // /* attach new project name to path and 'cd' to that folder */
    // args.folder = path.join(args.folder, args._[1]);
    // mkdirp.sync(args.folder);
    // process.chdir(args.folder);
    // // await Util.runCmd(`cd ${args.folder}`);
    //
    // /* prepare the args */
    // const url = `${answers.type}://${answers.host}:${answers.port}?u=${answers.username}&p=${answers.password}&d=${answers.database}`;
    // args._[0] = answers.projectType === 'REST APIs' ? 'gar' : 'gag';
    // args.url.push(url);
    // return NewMgr.testConnection(args)
  }

  // public static async testConnection({url}) {
  //
  //   for (const u of url) {
  //     const parsedUrlData = URL.parse(u, true);
  //     const queryParams = parsedUrlData.query;
  //     const client = parsedUrlData.protocol.slice(0, -1);
  //     const config = {
  //       client,
  //       connection: {
  //         host: parsedUrlData.hostname,
  //         port: +parsedUrlData.port,
  //         user: queryParams.u,
  //         password: queryParams.p,
  //         database: client === 'pg' ? 'postgres' : (client === 'mssql' ? undefined : null)
  //       }
  //     };
  //
  //
  //     try {
  //       const knex = require('knex')(config)
  //       await knex.raw("SELECT 1+1 as data");
  //     } catch (e) {
  //       console.log(`\n😩 Test connection failed for : ${url}\n`.red.bold)
  //       return false;
  //     }
  //   }
  //   return true;
  // }

  // public static async isPortOpen(host, port) {
  //   try {
  //     return await tcpPortUsed.check(+port, host)
  //   } catch (e) {
  //     console.log(e)
  //     console.log(`\n😩 ${host}:${port} is not reachable please check\n`.red.bold)
  //     return true;
  //   }
  // }
}

export default InstantMgr;
