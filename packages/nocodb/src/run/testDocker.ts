import axios from 'axios';
import cors from 'cors';
import express from 'express';

import Noco from '../lib/Noco';
import User from '../lib/models/User';
process.env.NC_VERSION = '0009044';

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  })
);

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
  });
  server.use(await Noco.init({}, httpServer, server));

  // Wait for 0.5 seconds for the server to start
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!(await User.getByEmail('user@nocodb.com'))) {
    const response = await axios.post(
      `http://localhost:${process.env.PORT || 8080}/api/v1/auth/user/signup`,
      {
        email: 'user@nocodb.com',
        password: 'Password123.',
      }
    );
    console.log(response.data);
  }
})().catch((e) => console.log(e));

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
