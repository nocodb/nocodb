const path = require('path');
const { rspack } = require('@rspack/core');
const nodeExternals = require('webpack-node-externals');
module.exports = {
    entry: './src/run/dockerEntry.ts',
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
                    sourceMap: false,
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
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        tsConfig: {
            configFile: path.resolve('tsconfig.json'),
        },
    },
    output: {
        path: path.resolve('./docker'),
        filename: 'main.js',
        library: 'libs',
        libraryTarget: 'umd',
        globalObject: "typeof self !== 'undefined' ? self : this",
    },
    optimization: {
        minimize: true, //Update this to true or false
        minimizer: [
            new rspack.SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                    compress: {
                        keep_classnames: true,
                    },
                    mangle: {
                      keep_classnames: true,
                    },
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
    plugins: [
        new rspack.EnvironmentPlugin({
            EE: true,
        }),
    ],
    target: 'node',
    node: {
        __dirname: false,
    },
};