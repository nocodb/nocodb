import path from 'path';

const { DOCKER_DB_FILE } = process.env;

module.exports = {
  title: 'default',
  envs: {
    _noco: {
      db: [
        {
          client: 'sqlite3',
          connection: {
            client: 'sqlite3',
            connection: {
              filename:
                DOCKER_DB_FILE ||
                `${path.join(process.cwd(), 'xmigrator', 'default_dev.db')}`
            },
            useNullAsDefault: true
          },
          meta: {
            tn: 'nc_evolutions',
            dbAlias: 'primary'
          }
        }
      ]
    },
    test: {
      api: {},
      db: [
        {
          client: 'sqlite3',
          connection: {
            client: 'sqlite3',
            connection: {
              filename:
                DOCKER_DB_FILE ||
                `${path.join(process.cwd(), 'xmigrator', 'default_test.db')}`
            },
            useNullAsDefault: true
          },
          meta: {
            tn: 'nc_evolutions',
            dbAlias: 'primary'
          }
        }
      ]
    }
  },
  workingEnv: '_noco',
  meta: {
    version: '0.5',
    seedsFolder: 'seeds',
    queriesFolder: 'queries',
    apisFolder: 'apis',
    orm: 'sequelize',
    router: 'express'
  }
};
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
