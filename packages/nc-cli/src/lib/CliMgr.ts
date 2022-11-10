import Util from './util/Util';

import('colors');
import shell from 'shelljs';
// import AppMgr from './mgr/AppMgr';
import client from './mgr/Client';
// import ComponentMgr from './mgr/ComponentMgr';
// import MigrationMgr from './mgr/MigrationMgr';
// import ModelMgr from './mgr/ModelMgr';
// import OldNewMgr from './mgr/NewMgr';
// import InstantMgr from './mgr/InstantMgr';
// import PermissionsMgr from './mgr/PermissionsMgr';
// import SocialMgr from './mgr/SocialMgr';
// import DockerMgr from "./mgr/DockerMgr";
import NewMgr from './mgr/NewMgr';
// import TryMgr from "./mgr/TryMgr";

let cmdProcessedOnce = 0;
let cmdOriginalArgs = null;

class CliMgr {
  public static async runCmd(str) {
    shell.echo(`\nNow, executing command : ${str}\n\n`.blue);
    if (shell.exec(str).code !== 0) {
      shell.echo(`\n\nError running command internally\n\n\t"${str}"`.red);
      shell.echo(`\nExiting...`.red);
      shell.exit(1);
    }
  }

  public static async process(args) {
    cmdOriginalArgs = cmdOriginalArgs ? cmdOriginalArgs : args;

    try {
      if (args._ && args._.length) {
        switch (args._[0]) {
          case 'man':
            if (args._.length > 1) {
              Util.showHelpForCommand(args);
            } else {
              Util.showHelp(args);
            }

            process.exit(0);
            break;

          /**************** START : new project with apis creation ****************/
          case 'n':
          case 'new':
            if (await NewMgr.getNewProjectInput(args)) {
              if (args._[0] === 'gap') {
                console.log('gRPC code generation is not yet supported.');
                process.exit(0);
              }
              await client.requestSend(args);
            } else {
              process.exit(0);
            }

            break;

          /**************** END : new project with apis creation ****************/
          // /**************** START : new project with apis creation ****************/
          // case 'nold':
          // case 'newold':
          //   if (await NewMgr.getNewProjectInputOld(args)) {
          //     if (args._[0] === 'gap') {
          //       console.log('gRPC code generation is not yet supported.');
          //       process.exit(0)
          //     }
          //     await client.requestSend(args)
          //   } else {
          //     process.exit(0)
          //   }
          //
          //   break;
          //
          // /**************** END : new project with apis creation ****************/
          // /**************** START : try xc-instant with in-memory ****************/
          // case 't':
          // case 'try':
          //   await TryMgr.getProjectInput(args);
          //   process.exit(0)
          //   break;
          //
          // case 'sg':
          // case 'sample.gql':
          // case 'sample.graphql':
          //   await TryMgr.getProjectInput({_: ['sample', 'gql']});
          //   process.exit(0)
          //   break;
          //
          // case 'sr':
          // case 'sample.rest':
          // case 'sample':
          // case 's':
          //   await TryMgr.getProjectInput({_: ['sample', 'rest']});
          //   process.exit(0)
          //   break;
          //
          // /**************** END : try xc-instant with in-memory ****************/
          //
          // /**************** START : new project with apis creation ****************/
          // // case 'nold':
          // // case 'newold':
          // //   if (await OldNewMgr.getNewProjectInput(args)) {
          // //     if (args._[0] === 'gap') {
          // //       console.log('gRPC code generation is not yet supported.');
          // //       process.exit(0)
          // //     }
          // //     await client.requestSend(args)
          // //   } else {
          // //     process.exit(0)
          // //   }
          // //
          // //   break;
          //
          // /**************** END : new project with apis creation ****************/
          //
          //
          // /**************** START : new project with apis creation ****************/
          // case 'd':
          // case 'docker':
          //   await DockerMgr.genDockerfile(args)
          //   break;
          //
          // /**************** END : new project with apis creation ****************/
          //
          // //
          // // /**************** START : instant apis creation ****************/
          // // case 'i':
          // // case 'instant':
          // //   await InstantMgr.getNewProjectInput(args);
          // //   break;
          // //
          // // /**************** END : instant apis creation ****************/
          // /**************** START : Init xc instant project ****************/
          // case 'i':
          // case 'init':
          //   await NewMgr.initProject(args);
          //   break;
          //
          // /**************** END : Init xc instant project ****************/
          //
          // /**************** START : apis creation ****************/
          // case 'ga':
          // case 'gar':
          // case 'gen.apis':
          // case 'gen.apis.rest':
          //   // console.log(`xc : Generating REST APIs`.green, args);
          //   await client.requestSend(args);
          //   break;
          //
          // case 'gag':
          // case 'gen.apis.graphql':
          // case 'gen.apis.gql':
          //   // console.log(`xc : Generating GraphQL APIs`.green);
          //   await client.requestSend(args);
          //   break;
          // /**************** END : apis creation ****************/
          //
          //
          // case 'gm':
          // case 'gen.module':
          //   await client.requestSend(args);
          //   break;
          //
          // /**************** START : rest components scaffolding ****************/
          // case 'gmr':
          // case 'gen.module.router':
          //   await client.requestSend(args);
          //   break;
          //
          // case 'gmm':
          // case 'gen.module.middleware':
          //   await client.requestSend(args);
          //   break;
          //
          // case 'gms':
          // case 'gen.module.service':
          //   await client.requestSend(args);
          //   break;
          // /**************** END : rest components scaffolding ****************/
          //
          //
          // /**************** START : graphql components scaffolding ****************/
          // case 'ggm':
          // case 'gen.gql.module':
          //   await client.requestSend(args);
          //   break;
          //
          // case 'ggmr':
          // case 'gen.gql.module.resolver':
          //   await client.requestSend(args);
          //   break;
          //
          // case 'ggmm':
          // case 'gen.gql.module.middleware':
          //   await client.requestSend(args);
          //   break;
          //
          // case 'ggms':
          // case 'gen.gql.module.service':
          //   await client.requestSend(args);
          //   break;
          // /**************** END : graphql components scaffolding ****************/
          //
          //
          // /**************** START : Migration stuff ****************/
          // case 'db.migrate.init' :
          // case 'dmi' :
          //   console.log('migration init', args);
          //   await MigrationMgr.init(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.sync' :
          // case 'dms' :
          //   console.log('migration sync', args);
          //   await MigrationMgr.sync(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.list' :
          // case 'dml' :
          //   console.log('migration list');
          //   await MigrationMgr.list(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.create' :
          // case 'dmc' :
          //   console.log('migration create', args);
          //   await MigrationMgr.create(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.up' :
          // case 'dmu' :
          //   console.log('migration create', args);
          //   await MigrationMgr.up(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.down' :
          // case 'dmd' :
          //   console.log('migration down', args);
          //   await MigrationMgr.down(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.term' :
          // case 'dmt' :
          //   console.log('migration init', args);
          //   await MigrationMgr.clean(args);
          //   process.exit(0);
          //   break;
          //
          // case 'db.migrate.sql.dump' :
          // case 'dmsd' :
          //   console.log('migration meta dump', args);
          //   await client.requestSend(args);
          //   break;
          // /**************** END : Migration stuff ****************/
          //
          //
          // /**************** START : Meta stuff ****************/
          //
          // case 'meta.export' :
          // case 'me' :
          //   console.log('meta export', args);
          //   if (!('env' in args)) {
          //     console.log(`Missing '${'env'.bold}' parameter`.red);
          //     process.exit(0);
          //   }
          //
          //   await client.requestSend(args);
          //   break;
          // case 'meta.import' :
          // case 'mi' :
          //   console.log('meta import', args)
          //   if (!('env' in args)) {
          //     console.log(`Missing '${'env'.bold}' parameter`.red);
          //     process.exit(0);
          //   }
          //
          //   await client.requestSend(args);
          //   break;
          // case 'meta.reset' :
          // case 'mr' :
          //   console.log('met reset', args)
          //   if (!('env' in args)) {
          //     console.log(`Missing '${'env'.bold}' parameter`.red);
          //     process.exit(0);
          //   }
          //
          //   await client.requestSend(args);
          //   break;
          // /**************** END : Meta stuff ****************/
          //
          //
          // /**************** START : ACL stuff ****************/
          // case 'permissions.set':
          // case 'ps':
          //   await PermissionsMgr.set(args)
          //   process.exit(0);
          //   break;
          // case 'permissions.get':
          // case 'pg':
          //   await PermissionsMgr.get(args)
          //   process.exit(0);
          //   break;
          // case 'permissions.role.add':
          // case 'pra':
          //   await PermissionsMgr.userAdd(args)
          //   process.exit(0);
          //   break;
          // case 'permissions.role.delete':
          // case 'prd':
          //   await PermissionsMgr.userDelete(args)
          //   process.exit(0);
          //   break;
          // case 'permissions.role.rename':
          // case 'prr':
          //   await PermissionsMgr.userRename(args)
          //   process.exit(0);
          //   break;
          // /**************** END : ACL stuff ****************/
          //
          // /**************** START : App stuff ****************/
          // case 'app.install':
          // case 'ai':
          //   await AppMgr.install(args);
          //   process.exit(0);
          //   break;
          // case 'app.open':
          // case 'ao':
          //   await AppMgr.open(args);
          //   process.exit(0);
          //   break;
          //
          // /**************** END : App stuff ****************/
          //
          // /**************** START : Component stuff ****************/
          // case 'component.add':
          // case 'ca':
          //   const prevComponentName = await ComponentMgr.add(args);
          //   if (prevComponentName) {
          //     args._.push(prevComponentName)
          //     await client.requestSend(args);
          //   } else {
          //     process.exit(0)
          //   }
          //   break;
          //
          // case 'component.rename':
          // case 'cr':
          //   await ComponentMgr.rename(args);
          //   process.exit(0);
          //   break;
          //
          // case 'component.delete':
          // case 'cd':
          //   await ComponentMgr.add(args);
          //   process.exit(0);
          //   break;
          //
          // /**************** END : Component stuff ****************/
          //
          //
          // /**************** START : Social media stuff ****************/
          // case 'share':
          //   await SocialMgr.shareSocial(args);
          //   process.exit(0);
          //   break;
          //
          // case 'noshare':
          //   await SocialMgr.setShareRules('dontPrompt', true);
          //   process.exit(0);
          //   break;
          // /**************** END : Social media stuff ****************/
          //
          // /**************** START : Remove stuff ****************/
          // case 'remove.model.backup':
          // case 'rmb':
          //   await ModelMgr.removeModelBackups(args);
          //   process.exit(0);
          //   break;
          //
          // /**************** END : Remove stuff ****************/
          //
          // // case 'menu':
          // // case 'm':
          // //   await Menu.prepareCmd(client, args);
          // //   // console.log(args);
          // //   await this.process(client, args);
          // //   break;
          //
          // case 'yelp':
          // case 'y':
          //   Util.showHelp(args);
          //   process.exit(0)
          //   break;

          default:
            if (!cmdProcessedOnce) {
              cmdProcessedOnce = 1;
              // await this.process(Util.getShortVersion(args));
              args._.unshift('new');
              await this.process(args);
            } else {
              console.log(
                `\nUnknown command. ${cmdOriginalArgs._[0]} -- please see help below`
              );
              Util.showHelp(cmdOriginalArgs);
              process.exit(0);
            }
            break;
        }
      }
    } catch (e) {
      throw e;
    }
  }
}

export default CliMgr;
