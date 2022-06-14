import debug from 'debug';

const namespaces = {};

const levels = {
  api: 'A',
  info: 'I',
  error: 'E',
  warn: 'W',
  debug: 'D'
};
export default class DebugMgr {
  static _create(namespace) {
    if (namespaces[namespace]) {
      namespaces[namespace][`${namespace}_A`].enabled = debug.enabled(
        `${namespace}_A`
      );
      namespaces[namespace][`${namespace}_D`].enabled = debug.enabled(
        `${namespace}_D`
      );
      namespaces[namespace][`${namespace}_I`].enabled = debug.enabled(
        `${namespace}_I`
      );
      namespaces[namespace][`${namespace}_W`].enabled = debug.enabled(
        `${namespace}_W`
      );
      namespaces[namespace][`${namespace}_E`].enabled = debug.enabled(
        `${namespace}_E`
      );
    } else {
      namespaces[namespace] = {};

      namespaces[namespace][`${namespace}_A`] = {
        level: 'api',
        enabled: debug.enabled(`${namespace}_A`)
      };
      namespaces[namespace][`${namespace}_W`] = {
        level: 'warn',
        enabled: debug.enabled(`${namespace}_W`)
      };
      namespaces[namespace][`${namespace}_I`] = {
        level: 'info',
        enabled: debug.enabled(`${namespace}_I`)
      };
      namespaces[namespace][`${namespace}_E`] = {
        level: 'error',
        enabled: debug.enabled(`${namespace}_E`)
      };
      namespaces[namespace][`${namespace}_D`] = {
        level: 'debug',
        enabled: debug.enabled(`${namespace}_D`)
      };
    }
  }

  static createNamespace(namespace) {
    if (!(namespace in namespaces)) {
      this._create(namespace);
      // console.log(namespaces);
    }
  }

  static getNamespaces() {
    return namespaces;
  }

  static refreshNamespace(namespace) {
    this._create(namespace);
  }

  static enable(namespace, level) {
    const toBeEnabled = `${namespace}_${levels[level]},${debug.disable()}`;
    debug.enable(`${toBeEnabled}`);
    this.refreshNamespace(namespace);
  }

  static disable(namespace, level) {
    const toBeRemoved = `${namespace}_${levels[level]}`;
    let list = `${debug.disable()}`;
    list = list.replace(toBeRemoved, '');
    debug.enable(list);
    this.refreshNamespace(namespace);
  }

  static enableAll(namespace) {
    for (const key in levels) {
      debug.enable(`${namespace}_${levels[key]}`);
      this.refreshNamespace(namespace);
    }
  }

  static disableAll(namespace) {
    for (const key in levels) {
      debug.disable(`${namespace}_${levels[key]}`);
      this.refreshNamespace(namespace);
    }
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
