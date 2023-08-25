const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { resolveTsAliases } = require('./build-utils/resolveTsAliases');

module.exports = {
  entry: './src/run/local.ts',
  // devtool: 'inline-source-map',
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
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
        },
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
    filename: 'main.js',
    path: path.resolve(__dirname, 'docker'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [new webpack.EnvironmentPlugin(['EE'])],

  target: 'node',
};
