// The helpers reading what an editor drew: isTrailingBreak and staticCopy.
import { Mark } from "wordgard/doc";
import { basicSchema, horizontalRule, lineBreak } from "wordgard/schema";
import { GardSelection, GardState } from "wordgard/state";
import { Paragraph } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { staticCopy } from "../helpers/staticCopy.js";
import { isTrailingBreak } from "../helpers/trailingBreak.js";

// A block id drawn as `id`, as Stesura's kit draws it.
const BlockId = Mark.Type.define<string>("BlockId", {
  target: Paragraph,
  validate: "string",
  shape: { attribute: "id", value: 0 },
});

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
});

const create = (doc: string) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const config = [
    basicSchema(),
    lineBreak(),
    horizontalRule(),
    GardState.schemaElement.of(BlockId),
  ];
  const wg = ReactWordgard.create({ doc, config, parent });
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
    // A copy doesn't tell.
    expect(breaks.map((br) => isTrailingBreak(br.cloneNode()))).toEqual([false, false]);
  });
});

describe("staticCopy", () => {
  it("copies what the editor drew, without ids or the editor's own attributes", () => {
    const wg = create('<p id="one">a<br></p><p></p><hr>');
    const hr = wg.state.doc.content[2];
    if (!hr) throw new Error("No rule");
    wg.dispatch({ selection: GardSelection.node(wg.state.doc.length - hr.length, hr) });
    wg.flush();
    expect(wg.contentDOM.querySelector("#one")).not.toBeNull();
    expect(wg.contentDOM.querySelector(".wg-selected-node")).not.toBeNull();
    const copy = staticCopy(wg.contentDOM);
    expect(copy).not.toBe(wg.contentDOM);
    expect(copy.hasAttribute("contenteditable")).toBe(false);
    expect(
      copy.querySelector("[id], [contenteditable], .wg-selected-node, img.wg-buffer")
    ).toBeNull();
    expect(copy.querySelector("hr")?.hasAttribute("class")).toBe(false);
    expect(copy.innerHTML).toBe(
      '<p>a<br><br class="wg-trailing-break"></p><p><br class="wg-trailing-break"></p><hr>'
    );
    // The editor's own DOM is untouched.
    expect(wg.contentDOM.querySelector("#one")).not.toBeNull();
  });
});
