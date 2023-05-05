const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
<<<<<<<< HEAD:packages/nocodb/webpack.cloud.config.js
========
const CopyPlugin = require("copy-webpack-plugin");
//
>>>>>>>> develop-main:packages/nocodb-legacy/webpack.config.js
const TerserPlugin = require('terser-webpack-plugin');
// const JavaScriptObfuscator = require('webpack-obfuscator');
const path = require('path');
module.exports = {
<<<<<<<< HEAD:packages/nocodb/webpack.cloud.config.js
  entry: './src/run/cloud.ts',
========
  entry: './src/lib/index.ts',
>>>>>>>> develop-main:packages/nocodb-legacy/webpack.config.js
  // devtool: 'inline-source-map',
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
    nodeEnv:false
  },
  externals: [
    nodeExternals({
      allowlist: ['nocodb-sdk'],
    }),
  ],
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
<<<<<<<< HEAD:packages/nocodb/webpack.cloud.config.js
  plugins: [new webpack.EnvironmentPlugin(['EE'])],
========
  plugins: [
    new webpack.EnvironmentPlugin([
      'EE'
    ]),
    new CopyPlugin({
      patterns: [
        { from: 'src/lib/public', to: 'public' },
      ]
    })
    // new JavaScriptObfuscator({
    //   rotateStringArray: true,
    //   splitStrings: true,
    //   splitStringsChunkLength: 6
    // }, []),
  ],
>>>>>>>> develop-main:packages/nocodb-legacy/webpack.config.js

  target: 'node'
};
