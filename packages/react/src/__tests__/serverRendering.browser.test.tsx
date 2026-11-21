// Not in react-prosemirror: a page with an editor rendered on the server (React's server build,
// through vite.config.ts's `renderOnNodeServer`), then hydrated in the browser. The server has no
// editor (Wordgard needs the DOM); the browser draws WordgardEditor's children after hydration.
import React from "react";
import { flushSync } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { commands } from "vitest/browser";

import { Page } from "./fixtures/ssr/Page.js";

declare module "vitest/browser" {
  interface BrowserCommands {
    renderOnNodeServer: (file: string) => Promise<{ body: string }>;
  }
}

const serverPage = () =>
  commands.renderOnNodeServer("packages/react/src/__tests__/fixtures/ssr/render.tsx");

// Each test starts a Vite server: past the default timeout while the other projects run.
describe("server rendering", { timeout: 60_000 }, () => {
  it("renders the page around the editor on the server, without the editor", async () => {
    const { body } = await serverPage();
    const page = document.createElement("div");
    page.innerHTML = body;
    expect(page.querySelector("h1")?.textContent).toBe("Title");
    expect(page.querySelector("footer")?.textContent).toBe("After");
    expect(page.querySelector(".editor, output, [contenteditable]")).toBeNull();
  });

  it("hydrates the page, then draws the editor where WordgardEditor is", async () => {
    const { body } = await serverPage();
    const target = document.body.appendChild(document.createElement("div"));
    target.innerHTML = body;
    const title = target.querySelector("h1");
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    const recoverable = vi.fn();
    const root = hydrateRoot(target, <Page />, { onRecoverableError: recoverable });
    try {
      await vi.waitFor(() => expect(target.querySelector(".editor")).not.toBeNull(), {
        timeout: 10_000,
      });
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(recoverable).not.toHaveBeenCalled();
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
      flushSync(() => {
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Oh, ")] } });
        wg.flush();
      });
      expect(wg.contentDOM.firstElementChild?.textContent).toBe("Oh, Hello");
      expect(target.querySelector("output")?.textContent).toBe(String(wg.state.doc.length));
    } finally {
      warn.mockRestore();
      error.mockRestore();
      root.unmount();
      target.remove();
    }
  });
});
