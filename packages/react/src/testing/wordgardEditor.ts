// Wordgard's copied tests (test/wordgard/) import this instead of
// wordgard/editor in the `view` test project (vite.config.ts), so every editor
// they create is a ReactWordgard.
export * from "wordgard/editor";
export { ReactWordgard as Wordgard } from "../ReactWordgard.js";
