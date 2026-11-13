// Adapted from vue-wordgard's accessibility.browser.test.ts for Svelte: axe-core over editors drawn
// by svelte-wordgard, compared with plain Wordgard, Svelte decorations included. Wordgard's ARIA
// attributes must survive the drawing.
import axe from "axe-core";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Image, Link } from "wordgard/types";

import { SvelteWordgard } from "../SvelteWordgard.js";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import LinkView from "./fixtures/LinkMark.svelte";
import { reset } from "./fixtures/controls.js";
import Callout from "./fixtures/mark/Callout.svelte";
import PictureView from "./fixtures/mark/Picture.svelte";

const Picture = createWidgetType<null>({ component: PictureView });

const doc =
  '<h1>Title</h1><p>a <strong>b</strong> <a href="https://example.com">c</a> <img src="data:," alt="d"></p><blockquote><p>e</p></blockquote>';
const plain: GardState.Extension = [
  basicSchema(),
  blockquote(),
  image(),
  Wordgard.label("Document"),
];
const decorated: GardState.Extension = [
  plain,
  Decoration.Tag.shape(Blockquote, createShape(Callout).of("aside")),
  Decoration.Mark.shape(Link, createMarkShape(LinkView, { element: "a" })),
  Decoration.Tag.shape(Image, Picture.of(null)),
];

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  reset();
});

const mount = (create: (spec: Wordgard.Spec) => Wordgard, config: GardState.Extension) => {
  const parent = document.createElement("main");
  document.body.appendChild(parent);
  const wg = create({ doc, config, parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

// The rules an editor breaks, by id.
const violations = async (wg: Wordgard) =>
  (await axe.run(wg.dom, { resultTypes: ["violations"] })).violations.map(({ id }) => id).sort();

describe("Accessibility, in Svelte", () => {
  it("breaks no rule, as plain Wordgard on the same document", async () => {
    expect(await violations(mount(Wordgard.create, plain))).toEqual([]);
    expect(await violations(mount(SvelteWordgard.create, plain))).toEqual([]);
  });

  it("breaks no rule with Svelte shapes, marks and widgets", async () => {
    expect(await violations(mount(SvelteWordgard.create, decorated))).toEqual([]);
  });

  it("keeps Wordgard's attributes on the content element", () => {
    const { contentDOM } = mount(SvelteWordgard.create, decorated);
    expect(contentDOM.getAttribute("role")).toBe("textbox");
    expect(contentDOM.getAttribute("aria-multiline")).toBe("true");
    expect(contentDOM.getAttribute("aria-label")).toBe("Document");
  });
});
