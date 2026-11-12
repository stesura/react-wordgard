// Serves vue-wordgard's demo (`npm run demo:vue`). Vue's full build compiles the components'
// templates in the browser.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: [{ find: /^vue$/, replacement: "vue/dist/vue.esm-bundler.js" }] },
  // Vue's bundler build asks for its feature flags.
  define: {
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  build: { target: "esnext" },
});
