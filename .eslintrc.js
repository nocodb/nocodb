module.exports = {
  extends: ["eslint-config-airbnb-base", "eslint-config-prettier"],
  plugins: ["eslint-plugin-import", "eslint-plugin-prettier"],
  parserOptions: {
    ecmaFeatures: {
      ecmaVersion: 6
    }
  },
  env: {
    es6: true,
    node: true
  },
  rules: {
    "prettier/prettier": ["error", {}],
    "max-len": ["error", { code: 2000, ignoreUrls: true }],
    "linebreak-style": 0,
    "no-use-before-define": ["error", { functions: false, classes: false }],
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    "no-underscore-dangle": 0,
    "import/no-amd": 0,
    "import/no-dynamic-require": 0,
    "no-console": 0,
    "no-param-reassign": 0,
    "no-unused-vars": ["error", { argsIgnorePattern: "next" }],
    "comma-dangle": 0
  }
};
