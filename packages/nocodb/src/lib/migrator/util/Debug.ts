import boxen from 'boxen';
import debug from 'debug';

import('colors');
import DebugMgr from './DebugMgr';

export default class Debug {
  public namespace: any;
  public api: any;
  public warn: any;
  public info: any;
  public error: any;
  public debug: any;

  constructor(namespace) {
    this.namespace = namespace;

    this.api = debug(`${namespace}_A`);
    this.warn = debug(`${namespace}_W`);
    this.info = debug(`${namespace}_I`);
    this.error = debug(`${namespace}_E`);
    this.debug = debug(`${namespace}_D`);
    DebugMgr.createNamespace(namespace);
  }

  ppException(e, func = null) {
    let log = '';
    log += `                                              EXCEPTION OCCURED!! in ${this.namespace.red.bold} @ ${func}`;
    log += '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
      .red.bold;
    log += `MESSAGE:\n`.yellow.bold;
    log += `${e.message}\n`.yellow.bold;
    log += '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
      .red.bold;
    log += `CODE:\n`.yellow.bold;
    log += `${e.code}\n`.yellow.bold;
    log += '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
      .red.bold;
    log += `STACK:\n`.yellow.bold;
    log += `${e.stack}\n`.yellow.bold;
    log += '\n- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
      .red.bold;
    console.log(boxen(log, { padding: 1, borderStyle: 'double' }));
    console.log(e);
    return log;
  }

  ppe(e, func) {
    return this.ppException(e, func);
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
