/**
 * The `.spec.ts` files beside the sources had no config, so `test:unit` fed them
 * to babel-jest, which parses TS as JS and fails on the first annotation.
 *
 * `roots` pins collection to `src` — `build/` holds compiled twins of every spec
 * that jest would otherwise run as ESM-in-CJS. The mappers mirror
 * `src/ee/tsconfig.json`: `~/*` prefers the EE overlay, `src/*` stays CE-only.
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^~/(.*)$': ['<rootDir>/src/ee/$1', '<rootDir>/src/$1'],
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, diagnostics: false }],
  },
};
