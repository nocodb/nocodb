const { join, resolve } = require('path');
const { rspack } = require('@rspack/core');
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');

const baseDevConfig = {
  mode: 'development',
  target: 'node',
  devtool: 'inline-source-map',
  entry: {
    // HMR is failing in most of the cases for now. So, we are disabling it.
    // Uncomment the below line when enabling HMR
    // main: [process.env.ENTRYPOINT, 'webpack/hot/poll?100'],
    main: [process.env.ENTRYPOINT],
  },
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          sourceMap: true,
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
              dynamicImport: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'es2017',
            loose: true,
            externalHelpers: false,
            keepClassNames: true,
          },
          module: {
            type: 'commonjs',
            strict: false,
            strictMode: true,
            lazy: false,
            noInterop: false,
          },
        },
      },
    ],
  },
  externals: [
    nodeExternals({
      allowlist: ['webpack/hot/poll?1000'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
    tsConfig: {
      configFile: resolve('tsconfig.json'),
    },
  },
  optimization: {
    minimize: false,
    nodeEnv: false,
  },
  plugins: [
    new rspack.EnvironmentPlugin({
      EE: true,
      NODE_ENV: 'development',
    }),
    new RunScriptWebpackPlugin({
      name: 'main.js',
      // Set autorestart false when enabling HMR
      autoRestart: true,
    }),
    // Uncomment the below line when enabling HMR
    // new rspack.HotModuleReplacementPlugin(),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'src/public', to: 'public' }],
    }),
    new TsCheckerRspackPlugin({
      typescript: {
        configFile: resolve('tsconfig.json'),
      },
    }),
  ],
  output: {
    devtoolModuleFilenameTemplate: (info) => {
      const absolutePath = resolve(info.absoluteResourcePath);
      return `file://${absolutePath}`;
    },
    path: join(__dirname, 'dist'),
    filename: 'main.js',
    library: {
      type: 'commonjs2',
    },
    clean: true,
  },
  devServer: {
    // Uncomment the below line when enabling HMR
    //  hot: true,
  },
  cache: true,
  experiments: {
    cache: {
      type: 'persistent',
    },
  },
  watch: true,
  watchOptions: {
    ignored: /node_modules/,
    poll: 100,
  },
};

module.exports = baseDevConfig;
