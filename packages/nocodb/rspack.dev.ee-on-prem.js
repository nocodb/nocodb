const { resolve, join } = require('path');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');
const baseConfig = require('./rspack.dev.config');

module.exports = {
  ...baseConfig,
  resolve: {
    ...baseConfig.resolve,
    alias: {
      ...baseConfig.resolve.alias,
    },
    tsConfig: {
      configFile: resolve('src/ee-on-prem/tsconfig.json'),
    },
  },
  plugins: [
    ...baseConfig.plugins.slice(0, -1),
    new TsCheckerRspackPlugin({
      typescript: {
        configFile: join('src/ee-on-prem/tsconfig.json'),
        mode: 'write-tsbuildinfo',
        configOverwrite: {
          compilerOptions: {
            tsBuildInfoFile: resolve('node_modules/.cache/ee-on-prem.tsbuildinfo'),
          },
        },
      },
    }),
  ],
};
