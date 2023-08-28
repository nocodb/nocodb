const Noco = require('../build/main/lib/Noco').default;
const databaseConnection = require('../build/main/databaseConnection');
const reusables = require('../build/main/reusables');
const express = require('express');
const cors = require('cors');
const typeorm = require('typeorm');
const server = express();
server.enable('trust proxy');
server.use(cors());

server.set('view engine', 'ejs');

(async () => {
  let connection;
  if (!typeorm.getConnectionManager().has('default')) {
    connection = await databaseConnection.createDatabaseConnection();
  } else {
    connection = typeorm.getConnectionManager().get('default');
  }
  await databaseConnection.runMigrations(connection);
  await reusables.setupReusablesAndRoutes(server, connection);

  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
