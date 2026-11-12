// Wordgard's copied tests (test/wordgard/) import this instead of wordgard/editor in the
// `view-vue` test project (vite.config.ts), so every editor they create is a VueWordgard.
export * from "wordgard/editor";
export { VueWordgard as Wordgard } from "../VueWordgard.js";
