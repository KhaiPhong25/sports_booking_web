import eslint from "@eslint/js";

export default [
  eslint.configs.recommended,
  { ignores: ["dist/**", "coverage/**"] },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        fetch: "readonly",
        FormData: "readonly",
      },
    },
  },
  {
    files: ["e2e/**/*.js"],
    languageOptions: {
      globals: {
        URL: "readonly",
        setTimeout: "readonly",
        SubmitEvent: "readonly",
      },
    },
  },
  {
    files: ["playwright.config.js"],
    languageOptions: { globals: { process: "readonly" } },
  },
];
