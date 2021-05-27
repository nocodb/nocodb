const Noco = require("../build/main/lib/noco/Noco").default;
const express = require('express');
const cors = require('cors');
const server = express();
server.use(cors());


server.set('view engine', 'ejs');

// process.env[`DEBUG`] = '*';


(async () => {
  server.use(await Noco.init({}));
  server.listen(process.env.PORT || 8080, () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
  })
})().catch(e => console.log(e))


