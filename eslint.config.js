const nodePlugin = require('eslint-plugin-node');
const jestPlugin = require('eslint-plugin-jest');

module.exports = [
  {
    files: ['**/*.js'],
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
        exports: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
      }
    },
    plugins: {
      node: nodePlugin,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-undef': 'error',
    }
  },
  {
    files: ['tests/**/*.js', '**/*.test.js', 'jest.config.js'],
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
        exports: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        URL: 'readonly',
      }
    },
    plugins: {
      jest: jestPlugin,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-undef': 'error',
    }
  },
  {
    files: ['k6/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-undef': 'off', // k6 has its own globals
    }
  }
];
