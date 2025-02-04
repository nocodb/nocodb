/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^\~/(.+)$': '<rootDir>/src/$1'
  },
  testMatch: ['**/src/**/*.(spec|test).ts']
};