// Fails if a `view-svelte*` project stops running the Svelte build it's named for (vite.config.ts's
// `svelteProject`): a misconfigured one would pass as a second `view-svelte`.
import { flushSync, getAbortSignal, mount, unmount } from "svelte";
import { inject } from "vitest";

import Plain from "../../packages/svelte/src/__tests__/fixtures/Plain.svelte";

declare module "vitest" {
  export interface ProvidedContext {
    svelteBuild: "development" | "production" | "async";
  }
}

const build = inject("svelteBuild");

describe(`view-svelte project (${build})`, () => {
  it("compiles components for its build", () => {
    const target = document.body.appendChild(document.createElement("div"));
    const root = mount(Plain, { target, props: { n: 1 } });
    flushSync();
    // Svelte's development build records each element's place in its source.
    expect("__svelte_meta" in (target.firstElementChild ?? {})).toBe(build != "production");
    void unmount(root);
    target.remove();
  });

  it("runs Svelte's runtime for its build", () => {
    // Svelte's production runtime throws a link to the error only, its development runtime the text.
    expect(() => getAbortSignal()).toThrow(
      build == "production" ? /^https:/ : /`getAbortSignal\(\)`/
    );
  });

  it("turns async mode on in the async build only", async () => {
    // A component compiled with `experimental.async` imports the flag that turns it on.
    const source = await (
      await fetch(
        new URL("../../packages/svelte/src/__tests__/fixtures/Plain.svelte", import.meta.url)
      )
    ).text();
    expect(/flags[/_]async/.test(source)).toBe(build == "async");
  });
});
