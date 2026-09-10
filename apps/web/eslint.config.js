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
];
