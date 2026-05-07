const { join, resolve } = require('path');
const { rspack } = require('@rspack/core');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: {
    main: ['./packages/nocodb/src/run/docker.ts'],
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: { name: '[path][name].[ext]' },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
              dynamicImport: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'es2017',
            loose: true,
            keepClassNames: true,
          },
          module: { type: 'commonjs' },
        },
      },
    ],
  },
  externals: [
    nodeExternals({
      modulesDir: resolve(__dirname, 'node_modules'),
      allowlist: [/^nc-gui/, /^nocodb-sdk/, /^nc-mail/],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
    tsConfig: {
      configFile: resolve(__dirname, 'packages/nocodb/tsconfig.json'),
    },
    alias: {
      '@noco-local-integrations': resolve(__dirname, 'packages/noco-integrations/packages'),
    },
  },
  optimization: {
    minimize: false,
    nodeEnv: false,
  },
  plugins: [
    new rspack.EnvironmentPlugin({
      EE: true,
      NODE_ENV: 'production',
    }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'packages/nocodb/src/public', to: 'public' }],
    }),
  ],
  output: {
    path: join(__dirname, 'dist'),
    filename: 'main.js',
    library: { type: 'commonjs2' },
    clean: true,
  },
};
