const { resolve, join } = require('path');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');
const baseConfig = require('./rspack.dev.config');

module.exports = {
  ...baseConfig,
  resolve: {
    ...baseConfig.resolve,
    tsConfig: {
      configFile: resolve('tsconfig.ce.json'),
    },
  },
  plugins: [
    ...baseConfig.plugins.slice(0, -1),
    new TsCheckerRspackPlugin({
      typescript: {
        configFile: join('tsconfig.ce.json'),
        mode: 'write-tsbuildinfo',
        configOverwrite: {
          compilerOptions: {
            tsBuildInfoFile: resolve('node_modules/.cache/ce.tsbuildinfo'),
          },
        },
      },
    }),
  ],
};
