const js = require('@eslint/js');

module.exports = [
  // Global ignores
  {
    ignores: [
      '_test/**',
      'node_modules/**',
      '.git/**'
    ]
  },

  // Base recommended rules
  js.configs.recommended,

  // Custom project rules
  {
    files: [
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs'
    ],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'block', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: '*', next: 'function' }
      ],
      'array-element-newline': 'off',
      'array-bracket-newline': 'off',
      'object-curly-newline': 'off',
      'object-property-newline': 'off',
      'space-before-function-paren': ['error', 'always'],
      'space-before-blocks': 'error',
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'curly': ['error', 'all'],
      'no-unused-vars': ['error', { 'args': 'after-used', 'argsIgnorePattern': '^_' }],
      'no-var': 'error',
      'prefer-const': ['error', { 'destructuring': 'any' }]
    }
  }
];
