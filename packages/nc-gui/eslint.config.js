import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  ignores: [
    '!*.d.ts',
    'components.d.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/.nuxt/**',
    '**/output/**',
    '**/.output/**',
  ],
}, {
  rules: {
    'vue/no-setup-props-destructure': 'off',
    'no-console': 'off',
    'antfu/if-newline': 'off',
    'no-unused-vars': 'off',
    'ts/no-this-alias': 'off',
    'ts/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
  },
})
