const express = require('express');
const path = require('path');

class XcLibGui {
  static expressMiddleware(dashboardPath) {
    const router = express.Router();
    // express will serve up production assets i.e. main.js
    // dist will be generated from the build in `nc-gui`. See `build:copy` command in `nc-gui`.
    router.use(dashboardPath, express.static(path.join(__dirname, 'dist')));
    return router;
  }
}

module.exports = XcLibGui;