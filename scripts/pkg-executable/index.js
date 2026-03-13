process.env.NC_BINARY_BUILD = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require("nocodb/dist/bundle.js");
