const path = require('path');

process.env.NC_BINARY_BUILD = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.NC_GUI_DIST_PATH =
  process.env.NC_GUI_DIST_PATH ||
  path.join(path.dirname(require.resolve('nocodb/package.json')), 'docker', 'nc-gui');
require("nocodb/dist/bundle.js");
