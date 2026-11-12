// Wordgard's copied tests (test/wordgard/) import this instead of wordgard/editor in the
// `view-svelte` test project (vite.config.ts), so every editor they create is a SvelteWordgard.
export * from "wordgard/editor";
export { SvelteWordgard as Wordgard } from "../SvelteWordgard.js";
