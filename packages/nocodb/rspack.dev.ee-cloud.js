const { resolve, join } = require('path');
const baseConfig = require('./rspack.dev.config');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');

module.exports = {
  ...baseConfig,
  entry: {
    main: ['webpack/hot/poll?1000'],
  },
  resolve: {
    ...baseConfig.resolve,
    alias: {
      ...baseConfig.resolve.alias,
    },
    tsConfig: {
      configFile: resolve('tsconfig.ee-cloud.json'),
    },
  },
  plugins: [
    ...baseConfig.plugins.slice(0, -1),
    new TsCheckerRspackPlugin({
      typescript: {
        configFile: join('tsconfig.ee-cloud.json'),
      },
    })
  ],
};
