const path = require('path');
const { rspack } = require('@rspack/core');
const { resolveTsAliases } = require('../build-utils/resolveTsAliases');
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
                    },
                    module: {
                        type: 'commonjs',
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        alias: resolveTsAliases(path.resolve('tsconfig.json')),
    },
    output: {
        path: require('path').resolve('./docker'),
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
                },
            }),
        ],
        nodeEnv: false,
    },
    externals: [nodeExternals()],
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