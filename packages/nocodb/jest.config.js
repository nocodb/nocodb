// jest.config.js
// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts', 'node'],
  rootDir: 'src',
  testRegex: '(Integration|Source)\\.spec\\.ts$',
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': [
      '<rootDir>/$1',
      // '<rootDir>/$1/index'
    ],
    '^~/(.*)$': [
      '<rootDir>/ee/$1',
      '<rootDir>/$1',
      // '<rootDir>/ee/$1/index',
      // '<rootDir>/$1/index',
    ],
    '^@/(.*)$': ['<rootDir>/ee/$1', '<rootDir>/$1'],
  },
  // [...]
  // moduleNameMapper: pathsToModuleNameMapper(
  //   compilerOptions.paths /*, { prefix: '<rootDir>/' } */,
  // ),
  // modulePaths: [compilerOptions.baseUrl],
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
  //   prefix: '<rootDir>/../',
  // }),
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
};
