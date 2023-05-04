const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/run/dockerEntry.ts',
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
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
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
