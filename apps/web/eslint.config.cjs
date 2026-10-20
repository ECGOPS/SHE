const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

function listed(config) {
  return (Array.isArray(config) ? config : [config]).map((entry) => ({
    ...entry,
    files: ['**/*.{ts,tsx}'],
  }));
}

module.exports = [
  { ignores: ['dist/**', 'dev-dist/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    settings: { react: { version: 'detect' } },
  },
  { ...js.configs.recommended, files: ['**/*.{ts,tsx}'] },
  ...listed(tseslint.configs['flat/eslint-recommended']),
  ...listed(tseslint.configs['flat/recommended']),
  { ...react.configs.flat.recommended, files: ['**/*.{ts,tsx}'] },
  { ...react.configs.flat['jsx-runtime'], files: ['**/*.{ts,tsx}'] },
  { ...reactHooks.configs['recommended-latest'], files: ['**/*.{ts,tsx}'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'react/prop-types': 'off',
      'react/no-danger': 'error',
      'no-eval': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
