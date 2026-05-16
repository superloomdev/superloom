// ESLint config for js-server-helper-storage-aws-s3-url-signer
'use strict';

module.exports = [
  {
    ignores: ['node_modules/', '_test/node_modules/']
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'error',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
