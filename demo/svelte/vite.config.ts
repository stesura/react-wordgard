// Serves svelte-wordgard's demo (`npm run demo:svelte`), its components compiled by Svelte's plugin,
// with HMR on the dev server.
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [svelte()],
  // svelte-wordgard from its src.
  resolve: { conditions: ["@stesura/source", ...defaultClientConditions] },
  build: { target: "esnext" },
});
