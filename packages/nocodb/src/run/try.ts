import cors from 'cors';
import express from 'express';

import { NcConfigFactory, Noco } from '../lib';

process.env.DATABASE_URL = 'mysql://root:password@localhost:3306/sakila';

const url = NcConfigFactory.extractXcUrlFromJdbc(process.env.DATABASE_URL);

process.env.NC_DB = url;

(async () => {
  const server = express();
  server.enable('trust proxy');

  server.use(cors());
  server.set('view engine', 'ejs');
  const app = new Noco();
  server.use(
    await app.init({
      async afterMetaMigrationInit(): Promise<void> {
        if (!(await app.ncMeta.projectList())?.length) {
          const config = await NcConfigFactory.makeProjectConfigFromUrl(url);
          const project = await app.ncMeta.projectCreate(
            config.title,
            config,
            ''
          );
          await app.ncMeta.projectStatusUpdate(project.id, 'started');
          await app.ncMeta.projectAddUser(project.id, 1, 'owner,creator');
        }
      },
    })
  );
  server.listen(process.env.PORT || 8080, () => {
    console.log(
      `App started successfully.\nVisit -> http://localhost:${
        process.env.PORT || 8080
      }/xc`
    );
  });
})().catch((e) => console.log(e));
