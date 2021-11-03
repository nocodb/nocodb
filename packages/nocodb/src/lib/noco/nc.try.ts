import cors from 'cors';
import express from 'express';

import NcConfigFactory from '../utils/NcConfigFactory';

import Noco from './Noco';

export default async function(dbUrl): Promise<void> {
  const server = express();
  server.use(cors());

  server.set('view engine', 'ejs');

  process.env[`NC_TRY`] = 'true';

  (async () => {
    const app = new Noco();
    server.use(
      await app.init({
        async afterMetaMigrationInit(): Promise<void> {
          const config = NcConfigFactory.makeProjectConfigFromUrl(dbUrl);
          await app.ncMeta.projectCreate(
            'Dvdrental (Sample SQLite Database)',
            config,
            ''
          );
          await app.ncMeta.projectStatusUpdate(
            'Dvdrental (Sample SQLite Database)',
            'started'
          );
        }
      })
    );
    server.listen(process.env.PORT || 8080, () => {
      console.log(
        `App started successfully.\nVisit -> http://localhost:${process.env
          .PORT || 8080}/xc`
      );
    });
  })().catch(e => console.log(e));
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
