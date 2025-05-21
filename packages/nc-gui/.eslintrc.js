const baseRules = {
  'vue/no-setup-props-destructure': 0,
  'no-console': 0,
  'antfu/if-newline': 0,
  'no-unused-vars': 0,
  '@typescript-eslint/no-this-alias': 0,
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  'prettier/prettier': ['error', {}, { usePrettierrc: true }],
}

module.exports = {
  extends: ['@antfu', 'plugin:prettier/recommended'],
  plugins: ['prettier'],
  rules: baseRules,
  ignorePatterns: ['!*.d.ts', 'components.d.ts', '**/typesense-docsearch.js'],
}
