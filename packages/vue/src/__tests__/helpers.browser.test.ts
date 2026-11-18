// Adapted from react-wordgard's helpers.browser.test.ts for Vue: isTrailingBreak and staticCopy (the
// core's) over what Vue drew, and useMergedDOMRefs.
import { defineComponent, h, shallowRef } from "vue";
import { Elt, Mark } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, horizontalRule, lineBreak } from "wordgard/schema";
import { GardSelection, GardState } from "wordgard/state";
import { Blockquote, HorizontalRule, Paragraph } from "wordgard/types";

import { isTrailingBreak, staticCopy } from "@stesura/wordgard-view";
import { VueWordgard } from "../VueWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { createShape } from "../decorations/VueShapeType.js";
import { useMergedDOMRefs } from "../hooks/useMergedDOMRefs.js";

// A block id drawn as `id`, as Stesura's kit draws it.
const BlockId = Mark.Type.define<string>("BlockId", {
  target: Paragraph,
  validate: "string",
  shape: { attribute: "id", value: 0 },
});

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
});

const create = (doc: string, config: GardState.Extension = []) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = VueWordgard.create({
    doc,
    config: [
      basicSchema(),
      lineBreak(),
      horizontalRule(),
      GardState.schemaElement.of(BlockId),
      config,
    ],
    parent,
  });
  wg.flush();
  editors.push(wg);
  return wg;
};

describe("isTrailingBreak", () => {
  it("tells the cursor's <br> from a line break's", () => {
    const wg = create("<p></p><p>a<br></p>");
    const [empty, broken] = wg.contentDOM.querySelectorAll("p");
    const breaks = [...(broken?.querySelectorAll("br") ?? [])];
    expect([...(empty?.querySelectorAll("br") ?? [])].map(isTrailingBreak)).toEqual([true]);
    expect(breaks.map(isTrailingBreak)).toEqual([false, true]);
    expect(breaks.map((br) => isTrailingBreak(br.cloneNode()))).toEqual([false, false]);
  });
});

describe("staticCopy", () => {
  it("leaves out the block buffers beside uneditable blocks", () => {
    const wg = create("<hr><p>a</p>", [
      Decoration.Tag.shape(HorizontalRule, Elt.mk("div", { class: "rule" })),
    ]);
    expect(wg.contentDOM.querySelector("img.wg-blockBuffer")).not.toBeNull();
    expect(staticCopy(wg.contentDOM).innerHTML).toBe('<div class="rule"></div><p>a</p>');
  });

  it("copies what the editor drew, without ids or the editor's own attributes", () => {
    const wg = create('<p id="one">a<br></p><p></p><hr>');
    const hr = wg.state.doc.content[2];
    if (!hr) throw new Error("No rule");
    wg.dispatch({ selection: GardSelection.node(wg.state.doc.length - hr.length, hr) });
    wg.flush();
    expect(wg.contentDOM.querySelector(".wg-selected-node")).not.toBeNull();
    const copy = staticCopy(wg.contentDOM);
    expect(copy.querySelector("[id], [contenteditable], .wg-selected-node")).toBeNull();
    expect(copy.innerHTML).toBe(
      '<p>a<br><br class="wg-trailing-break"></p><p><br class="wg-trailing-break"></p><hr>'
    );
    expect(wg.contentDOM.querySelector("#one")).not.toBeNull();
  });
});

describe("useMergedDOMRefs", () => {
  it("gives a ref and a function the root element of the component it is on", () => {
    const element = shallowRef<HTMLElement | null>(null);
    const given: (Element | null)[] = [];
    const Quote = createShape(
      defineComponent(() => {
        const root = useMergedDOMRefs(element, (dom) => given.push(dom));
        return () => h(DecorationRoot, { ref: root, content: true });
      })
    );
    const wg = create("<blockquote><p>a</p></blockquote>", [
      blockquote(),
      Decoration.Tag.shape(Blockquote, Quote),
    ]);
    const quote = wg.contentDOM.querySelector("blockquote");
    expect(quote).not.toBeNull();
    expect(element.value).toBe(quote);
    expect(given).toEqual([quote]);
    wg.dispatch({ changes: { from: 0, to: wg.state.doc.length, insert: [Paragraph.create()] } });
    wg.flush();
    expect(element.value).toBeNull();
    expect(given).toEqual([quote, null]);
  });
});
