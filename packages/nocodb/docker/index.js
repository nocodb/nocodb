const Noco = require('../build/main/lib/Noco').default;
const {
  createDatabaseConnection,
  runMigrations,
} = require('../build/main/databaseConnection');
const { setupReusablesAndRoutes } = require('../build/main/reusables');
const express = require('express');
const cors = require('cors');
const { getConnectionManager } = require('typeorm');
const server = express();
server.enable('trust proxy');
server.use(cors());

server.set('view engine', 'ejs');

(async () => {
  let connection;
  if (!getConnectionManager().has('default')) {
    connection = await createDatabaseConnection();
  } else {
    connection = getConnectionManager().get('default');
  }
  await runMigrations(connection);
  await setupReusablesAndRoutes(server, connection);

  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
