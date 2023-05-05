const nodeExternals = require('webpack-node-externals');
// const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin');
// const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = {
  entry: './docker/index.js',
  module: {
    rules: [
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  output: {
    path: require('path').resolve("./docker"),
    filename: "main.js",
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this"
  },
  optimization: {
    minimize: true, //Update this to true or false
    minimizer: [new TerserPlugin()],
    nodeEnv:false
  },
  externals: [nodeExternals()],
  plugins: [
    new webpack.EnvironmentPlugin([
      'EE'
    ]),
  ],
  target: 'node',
  node: {
    __dirname: false,
  },
};
