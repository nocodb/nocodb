module.exports = {
  title: 'default',
  envs: {
    _noco: {
      api: {},
      db: [
        {
          client: 'mssql',
          connection: {
            host: process.env.DOCKER_DB_HOST || 'localhost',
            port: process.env.DOCKER_DB_PORT
              ? parseInt(process.env.DOCKER_DB_PORT, 10)
              : null || 1433,
            user: 'sa',
            password: 'Password123.',
            database: 'default_dev'
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
          client: 'mssql',
          connection: {
            host: DOCKER_DB_HOST || 'localhost',
            port: DOCKER_DB_PORT ? parseInt(DOCKER_DB_PORT) : null || 1433,
            user: 'sa',
            password: 'Password123.',
            database: 'default_test'
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
