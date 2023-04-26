process.env.NC_BINARY_BUILD = 'true';
(async () => {
  try {
    const app = require('express')();
    const { Noco } = require("nocodb");
    const cors = require('cors')
    const httpServer = app.listen(process.env.PORT || 8080);
    app.use(cors())
    app.use(await Noco.init({}, httpServer, app));
    console.log(`Visit : localhost:${process.env.PORT}/dashboard`)
  } catch(e) {
    console.log(e)
  }
})()
