// #! /usr/bin/env node
import boxen from 'boxen';
import os from 'os';
import path from 'path';
import shell from 'shelljs';
// import tcpPortUsed from 'tcp-port-used';
// import promprRunOrDownload from '../prompts/RunOrDownload';
// import config from '../util/config';
// import {CmdSocketServer} from 'nc-help';
// import SocialMgr from './SocialMgr';

class Client {
  public static async requestSend(_args) {
    try {
      // await CmdSocketServer.cmdHandler(null, null, args);
      // const portOpen = await tcpPortUsed.check(config.port, 'localhost');
      // if (portOpen) {
      //
      //   // client.emit('__REQUEST__', args);
      // } else {
      //   await promprRunOrDownload.handle(args)
      //   process.exit(0);
      // }
    } catch (e) {
      console.log('Error generating code.', e.message);
      throw e;
    }
    process.exit(0);
  }

  public static async runCmd(str): Promise<any> {
    shell.echo(`\nNow, executing command : ${str}\n\n`.blue);
    const code = shell.exec(str).code;
    if (code !== 0) {
      // shell.echo(`\n\nError running command internally\n\n\t"${str}" - ${code}`.red);
      // shell.echo(`\nExiting...`.red);
      shell.exit(1);
    }
    return 0;
  }

  public static async responseHandle(args) {
    try {
      switch (args._[0]) {
        case 'ga':
        case 'gar':
        case 'gen.apis':
        case 'gen.apis.rest':
        case 'gag':
        case 'gen.apis.graphql':
        case 'gen.apis.gql':
          if (!args.err) {
            // SocialMgr.setCreatedApis(true)
            if (os.type() === 'Windows_NT') {
              console.log(
                boxen(
                  `# APIs generated successfully\n\n# Please run the following commands\n${
                    (
                      'cd ' +
                      path.dirname(args.folder) +
                      '; npm install ; npm run dev\n'
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
              await Client.runCmd(`npm install; npm run dev;`);
            }
          }
          break;

        case 'gc':
        case 'gen.controller':
          break;

        case 'gm':
        case 'gen.middleware':
          break;

        case 'gs':
        case 'gen.service':
          break;

        case 'ggt':
        case 'gen.gql.type':
          break;

        case 'gen.gql.schema':
          break;

        case 'ggr':
        case 'gen.resolver':
          break;

        case 'gen.block':
          break;

        case 'gen.cmd':
          break;

        case 'ac':
        case 'add.cmd':
          break;

        case 'ae':
        case 'add.env':
          break;

        case 'ad':
        case 'add.db':
          break;

        case 'menu':
        case 'm':
          break;

        case 'db.migrate.sql.dump':
        case 'dmm':
        case 'dmmd':
          console.log('db.migrate.sql.dump finished');
          break;

        default:
          break;
      }
    } catch (e) {
      throw e;
    }
  }
}

//
// const client = require('socket.io-client')(`http://localhost:${config.port}`);
//
// client.on('__DISCONNECT__', function () {
//   console.log('Disconnected from desktop app - Restart XGENE application'.red)
// });
//
// client.on('__CONNECT__', () => {
//   console.log('>>'.blue)
// });
//
// client.on('__RESPONSE__', (data) => {
//   console.log(`\n\t${data}`.green);
// });
//
// client.on('__FINISHED__', async (args) => {
//   console.log('\n<<'.blue);
//   await Client.responseHandle(args);
//   process.exit(0)
// });
//

export default Client;
