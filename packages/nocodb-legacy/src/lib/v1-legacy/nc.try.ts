import cors from 'cors';
import express from 'express';
import NcConfigFactory from '../utils/NcConfigFactory';
import Noco from '../Noco';

export default async function (dbUrl): Promise<void> {
  const server = express();
  server.use(cors());
  server.enable('trust proxy');

  server.set('view engine', 'ejs');

  process.env[`NC_TRY`] = 'true';

  (async () => {
    const app = new Noco();
    server.use(
      await app.init({
        async afterMetaMigrationInit(): Promise<void> {
          const config = await NcConfigFactory.makeProjectConfigFromUrl(dbUrl);
          await app.ncMeta.projectCreate(
            'Dvdrental (Sample SQLite Database)',
            config,
            ''
          );
          await app.ncMeta.projectStatusUpdate(
            'Dvdrental (Sample SQLite Database)',
            'started'
          );
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
}
