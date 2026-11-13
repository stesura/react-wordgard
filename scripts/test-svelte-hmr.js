// svelte-wordgard's HMR on the Svelte demo's dev server: edits decorations' .svelte files
// mid-session (Callout's chrome, then its root, then Link's root), then types and composes in their
// nodes. After each step the page must have logged no error, the edit must be in the state and the
// document must be drawn as a fresh editor draws its state. Chromium only: the composition goes
// through CDP.
import { readFileSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demo = resolve(root, "demo/svelte");
const callout = resolve(demo, "decorations/Callout.svelte");
const link = resolve(demo, "decorations/Link.svelte");

const originals = new Map([callout, link].map((file) => [file, readFileSync(file, "utf8")]));
const restore = () => {
  for (const [file, source] of originals)
    if (readFileSync(file, "utf8") != source) writeFileSync(file, source);
};
// Synchronous, so it also runs on exit.
process.on("exit", restore);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

// Writes `file` as its original with `edits` ([from, to] replacements) applied.
const edit = (file, edits) => {
  let source = originals.get(file) ?? "";
  for (const [from, to] of edits) {
    if (!source.includes(from)) throw new Error(`"${from}" isn't in ${file}`);
    source = source.replace(from, to);
  }
  writeFileSync(file, source);
};

const freePort = () =>
  new Promise((done, fail) => {
    const server = createNetServer();
    server.on("error", fail);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => (typeof address == "object" && address ? done(address.port) : fail()));
    });
  });

const chrome = ['class="callout-title"', 'class="callout-title" data-hmr="chrome"'];
const calloutRoot = ["data-kind={kind}>", 'data-kind={kind} data-hmr="root">'];
const linkRoot = ["<a {...rest} {href}", '<a {...rest} {href} data-hmr="link"'];

let server;
let browser;
const failures = [];
try {
  server = await createServer({
    configFile: resolve(demo, "vite.config.ts"),
    server: { port: await freePort(), strictPort: true },
    clearScreen: false,
    logLevel: "warn",
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("The dev server has no URL");

  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() == "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url);
  await page.waitForSelector("wg-content aside.callout");
  await page.waitForFunction(() => "wg" in window);
  const cdp = await page.context().newCDPSession(page);

  const frames = () =>
    page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    );

  // Puts the caret in the middle of the first text in the first `selector` in the document: inside
  // a link, not at its end, which the link's mark doesn't extend over.
  const caretIn = async (selector) => {
    await page.evaluate((selector) => {
      const element = window.wg.contentDOM.querySelector(selector);
      const text = element && document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode();
      if (!(text instanceof Text)) throw new Error(`No text in ${selector}`);
      window.wg.focus();
      document.getSelection()?.collapse(text, Math.floor(text.length / 2));
    }, selector);
    await frames();
  };

  // Types `typed`, then composes `kana` and commits it as `committed`.
  const typeAndCompose = async (typed, kana, committed) => {
    await page.keyboard.type(typed);
    await frames();
    for (let i = 1; i <= kana.length; i++)
      await cdp.send("Input.imeSetComposition", {
        text: kana.slice(0, i),
        selectionStart: i,
        selectionEnd: i,
      });
    await cdp.send("Input.insertText", { text: committed });
    await frames();
  };

  // The live editor's drawing (DOM and tiles) and a fresh SvelteWordgard's for its state, both
  // through the dev server's modules: the fresh one draws with the decorations as HMR left them.
  const compare = () =>
    page.evaluate(async () => {
      const svelteIndex = performance
        .getEntriesByType("resource")
        .map((entry) => new URL(entry.name).pathname)
        .find((path) => path.endsWith("/packages/svelte/src/index.ts"));
      if (!svelteIndex) throw new Error("svelte-wordgard isn't loaded from its source");
      const { SvelteWordgard } = await import(svelteIndex);
      const { drawn } = await import(
        svelteIndex.replace(/packages\/svelte\/src\/index\.ts$/, "test/editing.ts")
      );
      const { wg } = window;
      wg.flush();
      const parent = document.body.appendChild(document.createElement("div"));
      const fresh = SvelteWordgard.create({ state: wg.state, parent });
      fresh.flush();
      const result = { live: drawn(wg), fresh: drawn(fresh), text: wg.state.doc.textContent() };
      // Out of the page, the editor disconnects.
      parent.remove();
      return result;
    });

  const check = async (step, { selector, typed, kana, committed }) => {
    const before = errors.length;
    await caretIn(selector);
    await typeAndCompose(typed, kana, committed);
    // The link's card shows on hover.
    await page.mouse.move(0, 0);
    await frames();
    const { live, fresh, text } = await compare();
    const problems = [];
    if (errors.length > before) problems.push(`errors:\n  ${errors.slice(before).join("\n  ")}`);
    const inNode = await page.evaluate(
      ([selector, typed, committed]) =>
        window.wg.contentDOM.querySelector(selector)?.textContent?.includes(typed + committed),
      [selector, typed, committed]
    );
    if (!text.includes(typed + committed))
      problems.push(`"${typed + committed}" isn't in the state's text`);
    else if (!inNode) problems.push(`"${typed + committed}" isn't drawn in ${selector}`);
    if (text.includes(kana)) problems.push(`the composition's "${kana}" stayed in the state`);
    if (live.html != fresh.html)
      problems.push(
        `DOM differs from a fresh editor's:\n  live:  ${live.html}\n  fresh: ${fresh.html}`
      );
    if (live.tiles != fresh.tiles) problems.push("tiles differ from a fresh editor's");
    if (await page.locator("vite-error-overlay").count()) problems.push("Vite's error overlay");
    if (problems.length) failures.push(`${step}:\n ${problems.join("\n ")}`);
    console.log(`${problems.length ? "FAIL" : "ok  "} ${step}`);
  };

  // Waits for the HMR update: every node of the decoration redrawn as `selector` says.
  const applied = async (selector, all) => {
    await page.waitForFunction(
      ([selector, all]) => {
        const content = window.wg.contentDOM;
        return content.querySelectorAll(selector).length == content.querySelectorAll(all).length;
      },
      [selector, all],
      { timeout: 15000 }
    );
    await frames();
  };

  await check("before any edit", {
    selector: ".callout-body p",
    typed: "start",
    kana: "かな",
    committed: "仮名",
  });

  edit(callout, [chrome]);
  await applied('aside.callout .callout-title[data-hmr="chrome"]', "aside.callout");
  await check("Callout.svelte's chrome edited", {
    selector: ".callout-body p",
    typed: "chrome",
    kana: "にほん",
    committed: "日本",
  });

  edit(callout, [chrome, calloutRoot]);
  await applied('aside.callout[data-hmr="root"]', "aside.callout");
  await check("Callout.svelte's root edited", {
    selector: ".callout-body p",
    typed: "root",
    kana: "かんじ",
    committed: "漢字",
  });

  edit(link, [linkRoot]);
  await applied('a[data-hmr="link"]', "a");
  await check("Link.svelte's root edited", {
    selector: "a",
    typed: "link",
    kana: "もじ",
    committed: "文字",
  });

  restore();
  await applied("aside.callout:not([data-hmr]) .callout-title:not([data-hmr])", "aside.callout");
  await applied("a:not([data-hmr])", "a");
  await check("files restored", {
    selector: ".callout-body p",
    typed: "back",
    kana: "おわり",
    committed: "終わり",
  });
} catch (error) {
  failures.push(String(error instanceof Error ? (error.stack ?? error) : error));
} finally {
  restore();
  await browser?.close();
  await server?.close();
}

if (failures.length) {
  console.error(`\nsvelte-wordgard's HMR test failed:\n\n${failures.join("\n\n")}`);
  process.exit(1);
}
console.log("\nsvelte-wordgard's HMR test passed.");
