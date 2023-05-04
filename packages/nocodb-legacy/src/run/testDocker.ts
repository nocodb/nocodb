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
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));

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
  });
})().catch((e) => console.log(e));
