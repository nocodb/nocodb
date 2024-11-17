const { join } = require('path');
const { rspack } = require('@rspack/core');
const NodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

const baseDevConfig = {
  mode: 'development',
  target: 'node',
  devtool: 'eval-source-map',
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
          },
          module: {
            type: 'commonjs',
          },
        },
      },
    ],
  },
  externals: [
    NodeExternals({
      allowlist: ['webpack/hot/poll?1000'],
    }),
    {
      '@nestjs/microservices': '@nestjs/microservices',
      '@nestjs/microservices/microservices-module':
        '@nestjs/microservices/microservices-module',
      sharp: 'commonjs sharp',
      'nocodb-sdk': 'nocodb-sdk',
      'pg-query-stream': 'pg-query-stream',
      'better-sqlite3': 'better-sqlite3',
      oracledb: 'oracledb',
      'pg-native': 'pg-native',
      '@nestjs/graphql': '@nestjs/graphql',
      pg: 'commonjs pg',
      knex: 'commonjs knex',
    },
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
  },
  optimization: {
    minimize: false,
    nodeEnv: false,
  },
  plugins: [
    new rspack.EnvironmentPlugin({
      EE: true,
      NODE_ENV: 'development',
    }),
    new RunScriptWebpackPlugin({
      name: 'main.js',
      autoRestart: true,
    }),
  ],
  output: {
    path: join(__dirname, 'dist'),
    filename: 'main.js',
    library: {
      type: 'commonjs2',
    },
    clean: true,
  },
  devServer: {
    devMiddleware: {
      writeToDisk: true,
    },
    port: 9001,
  },
};

module.exports = baseDevConfig;
