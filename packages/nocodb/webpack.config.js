const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const CopyPlugin = require("copy-webpack-plugin");
//
const TerserPlugin = require('terser-webpack-plugin');
// const JavaScriptObfuscator = require('webpack-obfuscator');
const path = require('path');
module.exports = {
  entry: './src/lib/index.ts',
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
  externals: [nodeExternals()],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this"
  },
  node: {
    fs: 'empty'
  },
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

  target: 'node',
};