// eslint.env.mjs
import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import perfectionist from 'eslint-plugin-perfectionist';
import prettierPlugin from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
      perfectionist,
      prettier: prettierPlugin,
    },

    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },

    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.ts', '.tsx'],
        },
      },
    },

    rules: {
      ...prettierPlugin.configs.recommended.rules,
      '@typescript-eslint/no-floating-promises': 'error',
      'perfectionist/sort-named-exports': ['warn', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-named-imports': ['warn', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-imports': [
        'warn',
        {
          type: 'alphabetical',
          groups: [
            ['builtin', 'external'],
            ['internal', 'parent', 'sibling', 'index'],
          ],
        },
      ],
      'perfectionist/sort-union-types': ['warn', { type: 'alphabetical', order: 'asc' }],
      'perfectionist/sort-classes': [
        'warn',
        {
          type: 'alphabetical',
          order: 'asc',
          groups: [
            'index-signature',
            'static-property',
            'property',
            'private-property',
            'protected-property',
            'constructor',
            'static-method',
            'get-method',
            'set-method',
            'method',
            'async-method',
            'private-method',
            'protected-method',
            'unknown',
          ],
        },
      ],
      'prettier/prettier': [
        'warn',
        {
          singleQuote: true,
          printWidth: 120,
          semi: true,
          tabWidth: 2,
          arrowParens: 'avoid',
        },
      ],
      'max-len': [
        'warn',
        {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
        },
      ],
    },

    ignores: ['eslint.env.mjs', 'node_modules/', 'dist/', '.git/', '**/*.d.ts', '**/*.env.js'],
  },
];
