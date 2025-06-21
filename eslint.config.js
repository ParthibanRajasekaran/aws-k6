module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['eslint:recommended', 'plugin:node/recommended'],
  parserOptions: {
    ecmaVersion: 2022
  },
  rules: {
    'no-console': 'off',
    'node/no-unpublished-require': ['error', {
      'allowModules': ['aws-sdk-mock', 'jest']
    }]
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js'],
      rules: {
        'node/no-unpublished-require': 'off'
      }
    }
  ]
};
