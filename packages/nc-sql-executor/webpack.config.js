const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { resolveTsAliases } = require('../nocodb/build-utils/resolveTsAliases');

module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
      },
    ],
  },

  optimization: {
    nodeEnv: false,
  },
  externals: [
    nodeExternals({
      allowlist: ['knex-snowflake', 'knex-databricks'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    alias: resolveTsAliases(path.resolve('./tsconfig.json')),
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
