// @ts-nocheck
import js from '@eslint/js'
import globals from 'globals'
import node from 'eslint-plugin-n/configs/recommended-module.js'
import prettierConfig from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  node,
  prettierConfig,
  {
    files: ['packages/**/test/**'],
    rules: { 'n/no-unsupported-features/node-builtins': 'off' },
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
    },
  },
]
