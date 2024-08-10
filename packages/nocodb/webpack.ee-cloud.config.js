const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { resolveTsAliases } = require('./build-utils/resolveTsAliases');

module.exports = {
  entry: './src/run/cloud.ts',
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
    minimize: true, //Update this to true or false
    minimizer: [new TerserPlugin()],
    nodeEnv: false,
  },
  externals: [
    nodeExternals({
      allowlist: [
        'nocodb-sdk',
        'nc-plugin',
        'knex-snowflake',
        'knex-databricks',
      ],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    alias: resolveTsAliases(path.resolve('./src/ee-cloud/tsconfig.json')),
  },
  mode: 'production',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'docker'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new webpack.EnvironmentPlugin(['EE']),
    new CopyPlugin({
      patterns: [{ from: 'src/public', to: 'public' }],
    }),
  ],
  target: 'node',
};
