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
      // Code style rules
      'semi': ['error', 'always'],                    // Always require semicolons
      'quotes': ['error', 'single'],                  // Use single quotes for strings
      'indent': ['error', 2],                         // Use 2 spaces for indentation
      'comma-dangle': ['error', 'never'],             // No trailing commas
      'no-trailing-spaces': 'error',                  // No spaces at end of lines
      'eol-last': 'error',                            // Require newline at end of file

      // Spacing rules
      'padding-line-between-statements': [            // Add blank lines around functions/blocks
        'error',
        { blankLine: 'always', prev: 'block', next: '*' },
        { blankLine: 'always', prev: '*', next: 'block' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: '*', next: 'function' }
      ],

      // Array and object formatting (allow multi-line)
      'array-element-newline': 'off',                 // Allow flexible array formatting
      'array-bracket-newline': 'off',                 // Allow flexible array bracket placement
      'object-curly-newline': 'off',                  // Allow flexible object brace placement
      'object-property-newline': 'off',               // Allow flexible object property placement

      // Additional formatting preferences
      'space-before-function-paren': ['error', 'always'], // Space before function parentheses
      'space-before-blocks': 'error',                 // Space before blocks (if, for, etc.)
      'keyword-spacing': 'error',                     // Space around keywords
      'space-infix-ops': 'error',                     // Space around operators
      'object-curly-spacing': ['error', 'always'],    // Spaces inside object braces
      'array-bracket-spacing': ['error', 'never'],    // No spaces inside array brackets
      'comma-spacing': ['error', { 'before': false, 'after': true }], // Space after comma, none before
      'curly': ['error', 'all'],                                        // All if/else/for/while must use braces

      'no-unused-vars': ['error', { 'args': 'after-used', 'argsIgnorePattern': '^_' }], // Flag unused vars; args only checked after last used arg

      // Modern JS preferences (let/const over var)
      'no-var': 'error',                                                // Disallow `var` — use let/const instead
      'prefer-const': ['error', { 'destructuring': 'any' }]             // Use const when variable is never reassigned
    }
  }
];
