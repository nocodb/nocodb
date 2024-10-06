const nodeExternals = require('webpack-node-externals');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
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
            transpileOnly: true
          }
        },
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
    nodeEnv: false
  },
  externals: [nodeExternals()],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
  },
  output: {
    filename: 'cli.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  // node: {
  //   fs: 'empty'
  // },
  plugins: [
    new webpack.BannerPlugin({banner: "#! /usr/bin/env node", raw: true}),
  ],

  target: 'node',
};
