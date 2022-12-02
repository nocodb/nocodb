import fsExtra from 'fs-extra';
import glob from 'glob';
import path from 'path';

class ModelMgr {
  /***
   *
   * @param args
   * @param args.models
   * @param args.dbAlias
   * @param args.folder
   * @returns {Promise<void>}
   */
  public static async removeModelBackups(args) {
    try {
      args.dbAlias = args.dbAlias || '*';
      if (args.models) {
        for (const model of args.models.split('.')) {
          for (const file of glob.sync(
            path.join(
              args.folder,
              'server',
              'models',
              args.dbAlias,
              model,
              `${model}.meta.*.js`
            )
          )) {
            await fsExtra.remove(file);
            console.log(
              `Removed successfully : ${path.basename(file)}`.green.bold
            );
          }
        }
      } else {
        for (const file of glob.sync(
          path.join(
            args.folder,
            'server',
            'models',
            args.dbAlias,
            '*',
            '*.meta.*.js'
          )
        )) {
          await fsExtra.remove(file);
          console.log(
            `Removed successfully : ${path.basename(file)}`.green.bold
          );
        }
      }
    } catch (e) {
      console.log(`Error while removing backup file`.red.bold);
    }
  }
}

export default ModelMgr;
