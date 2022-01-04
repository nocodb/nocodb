import cors from 'cors';
import express from 'express';

import Noco from '../lib/noco/Noco';
process.env.NC_VERSION = '0009044';

const server = express();
server.use(
  cors({
    exposedHeaders: 'xc-db-response'
  })
);

server.set('view engine', 'ejs');

// process.env[`NC_DB`] = `mysql2://localhost:3306?u=root&p=password&d=mar_21`;
// process.env[`NC_DB`] = `pg://localhost:3306?u=root&p=password&d=mar_24`;
// process.env[`NC_DB`] = `pg://localhost:5432?u=postgres&p=password&d=abcde`;
// process.env[`NC_TRY`] = 'true';
// process.env[`NC_DASHBOARD_URL`] = '/test';

process.env[`DEBUG`] = 'xc*';

(async () => {
  server.use(await Noco.init({}));
  server.listen(process.env.PORT || 8080, () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
  });
})().catch(e => console.log(e));

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
