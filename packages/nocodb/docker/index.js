const Noco = require("../build/main/lib/noco/Noco").default;
const express = require('express');
const cors = require('cors');
const server = express();
server.use(cors());


server.set('view engine', 'ejs');


(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
  })
  server.keepAliveTimeout = 65000; // Ensure all inactive connections are terminated by the ALB, by setting this a few seconds higher than the ALB idle timeout
  server.headersTimeout = 66000; 
  server.use(await Noco.init({}, httpServer, server));
})().catch(e => console.log(e))


