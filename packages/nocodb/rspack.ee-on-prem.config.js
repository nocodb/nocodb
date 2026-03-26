const { resolve } = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { rspack } = require('@rspack/core');
const JavaScriptObfuscator = require('webpack-obfuscator');
const nodeExternals = require('webpack-node-externals');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');

/**
 * XOR-encode a PEM key string with a random mask for build-time injection.
 */
function xorEncode(pem) {
  const buf = Buffer.from(pem, 'utf-8');
  const mask = crypto.randomBytes(buf.length);
  const encoded = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) encoded[i] = buf[i] ^ mask[i];
  return { d: encoded.toString('base64'), m: mask.toString('base64') };
}

/**
 * Derive XOR-encoded license public keys at build time.
 * The source constants.ts contains plain PEM keys for dev convenience.
 * This reads them, XOR-encodes each with a random mask, and returns
 * the encoded data for DefinePlugin injection. At runtime, _resolveKeys()
 * and _resolveOldKey() decode them. Plain keys are dead-code eliminated.
 */
function deriveLicenseKeys() {
  const src = fs.readFileSync(
    resolve(__dirname, 'src/ee/utils/license/constants.ts'),
    'utf-8',
  );
  const keys = [];
  const re = /`(-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----)`/g;
  let m;
  while ((m = re.exec(src)) !== null) keys.push(m[1]);

  // First N-1 keys are the rotation array (_resolveKeys), last is the old key (_resolveOldKey)
  const rotationKeys = keys.slice(0, -1);
  const oldKey = keys[keys.length - 1];

  return {
    rotation: rotationKeys.map(xorEncode),
    old: oldKey ? xorEncode(oldKey) : null,
  };
}

module.exports = {
  entry: './src/run/cloud.ts',
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
          sourceMaps: false,
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

  optimization: {
    minimize: true,
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
      allowlist: ['nocodb-sdk', 'knex-snowflake', 'knex-databricks'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
    tsConfig: {
      configFile: resolve('./src/ee-on-prem/tsconfig.json'),
    },
    alias: {
      '@noco-local-integrations': resolve(__dirname, '../noco-integrations/packages'),
    },
  },
  mode: 'production',
  output: {
    filename: 'main.js',
    path: resolve(__dirname, 'docker'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new rspack.EnvironmentPlugin({
      EE: true,
    }),
    new rspack.DefinePlugin({
      __NC_DERIVED_KEYS__: JSON.stringify(deriveLicenseKeys().rotation),
      __NC_DERIVED_OLD_KEY__: JSON.stringify(deriveLicenseKeys().old),
    }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'src/public', to: 'public' }],
    }),
    new JavaScriptObfuscator(
      {
        // String protection — RC4 encrypts all strings at rest
        stringArray: true,
        stringArrayThreshold: 0.75,
        stringArrayEncoding: ['rc4'],
        rotateStringArray: true,
        splitStrings: true,
        splitStringsChunkLength: 6,

        // Identifiers
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
      },
      [],
    ),
    new TsCheckerRspackPlugin({
      typescript: {
        configFile: resolve('./src/ee-on-prem/tsconfig.json'),
      },
    }),
  ],
  target: 'node',
};
