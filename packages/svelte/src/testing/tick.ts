// For the tests: Svelte's `tick()` outside async mode, pending state applied after a microtask.
// With `experimental.async` on (the `view-svelte-async` project), Svelte's waits for a frame or a
// timeout, where Wordgard's scheduled flush runs first.
import { flushSync } from "svelte";

export const tick = async () => {
  await Promise.resolve();
  flushSync();
};
