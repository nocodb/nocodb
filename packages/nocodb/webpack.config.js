const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
//
const TerserPlugin = require('terser-webpack-plugin');

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
    minimize: true, //Update this to true or false
    minimizer: [new TerserPlugin()],
    nodeEnv: false,
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
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new webpack.EnvironmentPlugin(['EE']),
    new CopyPlugin({
      patterns: [{ from: 'public', to: 'public' }],
    }),
  ],

  target: 'node',
};
