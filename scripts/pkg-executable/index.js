process.env.NC_BINARY_BUILD = 'true';
(async () => {
  try {
    const app = require('express')();
    const { Noco } = require("nocodb");
    const cors = require('cors')
    const port = process.env.PORT || 8080;
    const httpServer = app.listen(port);
    app.use(cors())
    app.use(await Noco.init({}, httpServer, app));
    console.log(`Visit : localhost:${port}/dashboard`)
  } catch(e) {
    console.log(e)
  }
})()
