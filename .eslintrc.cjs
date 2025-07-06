module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
    webextensions: true,
    jest: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  rules: {
    // Allow console statements (useful for Chrome extension debugging)
    "no-console": "off",

    // Allow empty catch blocks (common in extension error handling)
    "no-empty": ["error", { allowEmptyCatch: true }],

    // Prefer const/let over var
    "prefer-const": "warn",
    "no-var": "error",

    // Allow unused vars with underscore prefix
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],

    // Common JS/TS patterns
    "no-undef": "off", // TypeScript handles this
  },
  ignorePatterns: ["build/", "dist/", "node_modules/"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      rules: {
        // Basic TypeScript rules without extends
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_" },
        ],
        "no-unused-vars": "off", // Turn off base rule for TS files
      },
    },
  ],
};
