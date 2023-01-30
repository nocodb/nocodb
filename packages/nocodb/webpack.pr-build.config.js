const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

const path = require('path');
module.exports = {
  entry: './src/run/prBuild.ts',
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
    minimize: true, //Update this to true or false
    minimizer: [new TerserPlugin()],
    nodeEnv: false
  },
  externals: [nodeExternals({
    allowlist: ['nocodb-sdk']
  })],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'docker'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this"
  },
  node: {
    fs: 'empty',
    __dirname: false,
  },
  plugins: [
    new webpack.EnvironmentPlugin([
      'EE'
    ]),
  ],

  target: 'node',
};
