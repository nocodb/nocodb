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
          for (const file of glob.sync(path.join(args.folder, 'server', 'models', args.dbAlias,model, `${model}.meta.*.js`))) {
            await fsExtra.remove(file)
            console.log(`Removed successfully : ${path.basename(file)}`.green.bold)
          }
        }
      } else {
        for (const file of glob.sync(path.join(args.folder, 'server', 'models', args.dbAlias, '*', '*.meta.*.js'))) {
          await fsExtra.remove(file)
          console.log(`Removed successfully : ${path.basename(file)}`.green.bold)
        }
      }
    }catch (e) {
      console.log(`Error while removing backup file`.red.bold)
    }

  }

}


export default ModelMgr;
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
