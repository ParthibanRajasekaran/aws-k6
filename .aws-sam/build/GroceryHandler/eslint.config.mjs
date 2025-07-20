// Basic ESLint config for ESLint v9+

export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // Add or adjust rules as needed
      semi: ["error", "always"],
      quotes: ["error", "single"],
    },
  },
];
