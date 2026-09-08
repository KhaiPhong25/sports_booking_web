import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "");
  return {
    envDir: repositoryRoot,
    server: {
      port: 5173,
      proxy: {
        "/api": env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
      },
    },
    preview: { port: 4173 },
  };
});
