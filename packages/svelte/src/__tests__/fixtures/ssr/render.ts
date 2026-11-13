// Loaded on the server, through the test project's Vite server (vite.config.ts's `renderOnServer`
// command): Page as SvelteKit renders it there.
import { render } from "svelte/server";

import Page from "./Page.svelte";

export default () => {
  const { head, body } = render(Page);
  return { head, body };
};
