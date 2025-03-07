const { resolve, join } = require('path');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');
const baseConfig = require('./rspack.dev.config');

module.exports = {
  ...baseConfig,
  resolve: {
    ...baseConfig.resolve,
    tsConfig: {
      configFile: resolve('tsconfig.ee.json'),
    },
  },
  plugins: [
    ...baseConfig.plugins.slice(0, -1),
    new TsCheckerRspackPlugin({
      typescript: {
        configFile: join('tsconfig.ee.json'),
      },
    }),
  ],
};
