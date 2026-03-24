const { resolve } = require('path');
const base = require('./rspack.ee-on-prem.config.js');

module.exports = {
  ...base,
  output: {
    ...base.output,
    filename: 'bundle.js',
    path: resolve(__dirname, 'dist'),
  },
};
