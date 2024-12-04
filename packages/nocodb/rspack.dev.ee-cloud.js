const { resolve, join } = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const baseConfig = require('./rspack.dev.config');

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
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: join('tsconfig.ee-cloud.json'),
      },
    }),
  ],
};
