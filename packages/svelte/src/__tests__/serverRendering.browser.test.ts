// Not in react-wordgard: a page with an editor rendered on the server, as SvelteKit renders it
// (Svelte's server build, through vite.config.ts's `renderOnServer`), then hydrated in the browser.
// The server has no editor (Wordgard needs the DOM); the browser draws WordgardEditor's children.
import { flushSync, hydrate, unmount } from "svelte";
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { commands } from "vitest/browser";

import { tick } from "../testing/tick.js";
import Page from "./fixtures/ssr/Page.svelte";

declare module "vitest/browser" {
  interface BrowserCommands {
    renderOnServer: (file: string) => Promise<{ head: string; body: string }>;
  }
}

const serverPage = () =>
  commands.renderOnServer("packages/svelte/src/__tests__/fixtures/ssr/render.ts");

describe("server rendering", () => {
  it("renders the page around the editor on the server, without the editor", async () => {
    const { body } = await serverPage();
    const page = document.createElement("div");
    page.innerHTML = body;
    expect(page.querySelector("h1")?.textContent).toBe("Title");
    expect(page.querySelector("footer")?.textContent).toBe("After");
    expect(page.querySelector(".editor, output, [contenteditable]")).toBeNull();
  });

  it("hydrates the page, drawing the editor where WordgardEditor is", async () => {
    const { body } = await serverPage();
    const target = document.body.appendChild(document.createElement("div"));
    target.innerHTML = body;
    const title = target.querySelector("h1");
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const app = hydrate(Page, { target });
    flushSync();
    try {
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      // Hydrated, not drawn anew.
      expect(target.querySelector("h1")).toBe(title);
      expect([...target.children].map((child) => child.localName)).toEqual([
        "h1",
        "output",
        "div",
        "footer",
      ]);
      const editorElement = target.querySelector(".editor")?.firstElementChild;
      const wg = editorElement ? Wordgard.findFromDOM(editorElement) : null;
      if (!wg) throw new Error("No editor in the page");
      expect(wg.contentDOM.querySelector("[data-note] div")?.textContent).toBe("quoted");
      expect(target.querySelector("output")?.textContent).toBe(String(wg.state.doc.length));
      wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Oh, ")] } });
      wg.flush();
      await tick();
      expect(wg.contentDOM.firstElementChild?.textContent).toBe("Oh, Hello");
      expect(target.querySelector("output")?.textContent).toBe(String(wg.state.doc.length));
    } finally {
      warn.mockRestore();
      error.mockRestore();
      void unmount(app);
      target.remove();
    }
  });
});
