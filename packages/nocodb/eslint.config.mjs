import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import eslintComments from 'eslint-plugin-eslint-comments';
import functional from 'eslint-plugin-functional';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // Base ESLint recommended
  js.configs.recommended,
  
  // Ignore patterns (must be first)
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'coverage/**',
      'dist/**',
      'nc/**',
      '**/*.spec.ts',
      'test/**',
      'src/types/nc-plugin/**',
    ],
  },
  
  // TypeScript config
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2020,
        BigInt: 'readonly',
        console: 'readonly',
        WebAssembly: 'readonly',
        NodeJS: 'readonly',
        BufferEncoding: 'readonly',
      },
    },
    plugins: {
      'import': importPlugin,
      'eslint-comments': eslintComments,
      'functional': functional,
      'prettier': prettier,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'none',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      }],
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/ban-types': 'off',
      
      // Import rules
      ...importPlugin.configs.typescript.rules,
      'sort-imports': ['error', {
        ignoreDeclarationSort: true,
        ignoreCase: true,
      }],
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type',
        ],
      }],
      
      // ESLint comments rules
      ...eslintComments.configs.recommended.rules,
      'eslint-comments/disable-enable-pair': ['error', {
        allowWholeFile: true,
      }],
      'eslint-comments/no-unused-disable': 'error',
      
      // Prettier
      'prettier/prettier': 'error',
      
      // Disabled rules (todo: enable)
      'no-useless-catch': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-redeclare': 'off',
      'no-unreachable': 'off',
      'no-unexpected-multiline': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-constant-binary-expression': 'off',
      'no-undef': 'off',
    },
  },
];