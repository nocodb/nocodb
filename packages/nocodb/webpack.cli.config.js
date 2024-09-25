const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { resolveTsAliases } = require('./build-utils/resolveTsAliases');

module.exports = {
  entry: './src/cli.ts',
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
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
    nodeEnv: false,
  },
  externals: [
    nodeExternals({
      allowlist: ['nocodb-sdk'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    alias: resolveTsAliases(path.resolve('tsconfig.json')),
  },
  mode: 'production',
  output: {
    filename: 'cli.js',
    path: path.resolve(__dirname, '..', 'nc-secret-mgr', 'src/nocodb'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new webpack.EnvironmentPlugin(['EE']),
    new webpack.BannerPlugin({
      banner: 'This is a generated file. Do not edit',
      entryOnly:true
    }),
  ],
  target: 'node',
};
