module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  globals: {
    uni: 'readonly',
    wx: 'readonly',
    plus: 'readonly',
    getCurrentPages: 'readonly',
    getApp: 'readonly',
    UniApp: 'readonly',
    UniHelper: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    parser: '@babel/eslint-parser'
  },
  extends: [
    'eslint:recommended'
  ],
  rules: {
    'no-unused-vars': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-empty': ['error', { allowEmptyCatch: false }],
    'prefer-const': 'warn',
    'no-var': 'error',
    'eqeqeq': 'warn',
    'no-undef': 'warn'
  },
  overrides: [
    {
      files: ['*.vue'],
      parser: 'vue-eslint-parser',
      extends: ['eslint:recommended', 'plugin:vue/vue3-recommended'],
      rules: {
        'vue/multi-word-component-names': 'off',
        'vue/max-attributes-per-line': 'off',
        'vue/singleline-html-element-content-newline': 'off'
      }
    }
  ]
}
