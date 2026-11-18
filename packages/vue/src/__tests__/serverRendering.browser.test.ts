// Adapted from react-wordgard's serverRendering.browser.test.tsx for Vue: a page with an editor
// rendered on the server (Vue's server renderer, through vite.config.ts's `renderOnNodeServer`), then
// hydrated in the browser. The server has no editor (Wordgard needs the DOM); the browser draws
// WordgardEditor's slot once the page has mounted, on an update pass.
import { type App, createSSRApp, nextTick } from "vue";
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { commands } from "vitest/browser";

import { Callbacks, log } from "./fixtures/ssr/Callbacks.js";
import { Page } from "./fixtures/ssr/Page.js";

declare module "vitest/browser" {
  interface BrowserCommands {
    renderOnNodeServer: (file: string) => Promise<{ body: string }>;
  }
}

const fixtures = "packages/vue/src/__tests__/fixtures/ssr";

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const settle = async () => {
  await nextTick();
  await tick();
};

const targets: HTMLElement[] = [];
const apps: App[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const target of targets.splice(0)) target.remove();
});

const hydrate = (body: string, root: Parameters<typeof createSSRApp>[0]) => {
  const target = document.body.appendChild(document.createElement("div"));
  targets.push(target);
  target.innerHTML = body;
  const app = createSSRApp(root);
  apps.push(app);
  app.mount(target);
  return target;
};

describe("server rendering", () => {
  it("renders the page around the editor on the server, without the editor", async () => {
    const { body } = await commands.renderOnNodeServer(`${fixtures}/render.ts`);
    const page = document.createElement("div");
    page.innerHTML = body;
    expect(page.querySelector("h1")?.textContent).toBe("Title");
    expect(page.querySelector("footer")?.textContent).toBe("After");
    expect(page.querySelector(".editor, output, [contenteditable]")).toBeNull();
  });

  it("hydrates the page, then draws the editor where WordgardEditor is", async () => {
    const { body } = await commands.renderOnNodeServer(`${fixtures}/render.ts`);
    const warn = vi.spyOn(console, "warn");
    const error = vi.spyOn(console, "error");
    try {
      const target = hydrate(body, Page);
      const title = target.querySelector("h1");
      // Hydrated without the editor, which comes on the update after the mount.
      expect(target.querySelector(".editor")).toBeNull();
      await settle();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
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
      await settle();
      expect(wg.contentDOM.firstElementChild?.textContent).toBe("Oh, Hello");
      expect(target.querySelector("output")?.textContent).toBe(String(wg.state.doc.length));
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  // WordgardEditor.browser.test.ts's "draws the document on an update, the app's callbacks in
  // their order", on the path every hydrated page takes.
  it("draws the document on the update after hydration, the app's callbacks in their order", async () => {
    const { body } = await commands.renderOnNodeServer(`${fixtures}/renderCallbacks.ts`);
    log.length = 0;
    const target = hydrate(body, Callbacks);
    expect(log).toEqual([]);
    await settle();
    expect(log).toEqual(["before true", "after true", "widget true"]);
    const wg = Wordgard.findFromDOM(target.querySelector("wordgard-editor") ?? target);
    expect(wg?.connected).toBe(true);
    expect(wg?.contentDOM.textContent).toBe("ma");
  });
});
