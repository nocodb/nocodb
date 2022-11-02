const express = require('express');
const path = require('path');


class XcLibGui {

  static expressMiddleware(dashboardPath) {

    const router = express.Router();
    // Express will serve up production assets i.e. main.js
    router.use(dashboardPath, express.static(path.join(__dirname, 'dist')));

    return router;
  }
}

module.exports = XcLibGui;


