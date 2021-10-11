import debug from 'debug';

export default class NcHelp {
  public static async executeOperations(
    fns: Array<() => Promise<any>>,
    dbType: string
  ): Promise<any> {
    if (dbType === 'oracledb') {
      for (const fn of fns) {
        await fn();
      }
    } else {
      await Promise.all(
        fns.map(async f => {
          await f();
        })
      );
    }
  }

  public static enableOrDisableDebugLog(args: {
    [key: string]: boolean;
  }): void {
    const enabledKeys = debug
      .disable()
      .split(',')
      .filter(v => v.trim());
    for (const [key, enabled] of Object.entries(args)) {
      if (enabled) {
        if (!enabledKeys.includes(key)) {
          enabledKeys.push(key);
        }
      } else {
        const index = enabledKeys.indexOf(key);
        if (index > -1) {
          enabledKeys.splice(index, 1);
        }
      }
    }

    debug.enable(enabledKeys.join(','));
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
