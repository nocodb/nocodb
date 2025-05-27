const path = require('path');
const { resolve } = require('path');
const { rspack } = require('@rspack/core');
const nodeExternals = require('webpack-node-externals');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: resolve('./src/index.ts'),
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[path][name].[ext]',
        },
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
            externalHelpers: false,
            keepClassNames: true,
          },
          module: {
            type: 'commonjs',
            strict: false,
            strictMode: true,
            lazy: false,
            noInterop: false,
          },
        },
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin({
        minimizerOptions: {
          compress: {
            keep_classnames: true,
          },
          mangle: {
            keep_classnames: true,
          },
        },
      }),
    ],
    nodeEnv: false,
  },
  externals: [
    nodeExternals({
      allowlist: ['knex-snowflake', 'knex-databricks'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
    tsConfig: {
      configFile: resolve('./tsconfig.json'),
    },
  },

  mode: 'production',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [],
  target: 'node',
};
