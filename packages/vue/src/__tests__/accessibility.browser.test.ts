// Adapted from react-wordgard's accessibility.browser.test.tsx for Vue: axe-core over editors drawn
// by Vue, compared with plain Wordgard, Vue decorations included. Wordgard's ARIA attributes must
// survive Vue's drawing.
import axe from "axe-core";
import { defineComponent } from "vue";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Image, Link } from "wordgard/types";

import { VueWordgard } from "../VueWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { NodeContent } from "../components/NodeContent.js";
import { createMarkShape } from "../decorations/VueMarkType.js";
import { createShape } from "../decorations/VueShapeType.js";
import { createWidgetType } from "../decorations/VueWidgetType.js";

// A callout as the README advises: its decorative icon hidden, its control
// labelled.
const Callout = defineComponent({
  props: ["nodeProps"],
  components: { DecorationRoot, NodeContent },
  template: `
    <DecorationRoot>
      <span aria-hidden="true">!</span>
      <button type="button" aria-label="Collapse">-</button>
      <NodeContent as="div" />
    </DecorationRoot>`,
});

const LinkView = defineComponent({
  props: ["markProps"],
  components: { DecorationRoot, NodeContent },
  template: `
    <DecorationRoot :href="String(markProps.mark.value)">
      <NodeContent as="span" />
    </DecorationRoot>`,
});

const Picture = createWidgetType({
  component: defineComponent({
    props: ["value"],
    template: `<img src="data:," alt="A picture" />`,
  }),
});

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

describe("Accessibility, in Vue", () => {
  it("breaks no rule, as plain Wordgard on the same document", async () => {
    expect(await violations(mount(Wordgard.create, plain))).toEqual([]);
    expect(await violations(mount(VueWordgard.create, plain))).toEqual([]);
  });

  it("breaks no rule with Vue shapes, marks and widgets", async () => {
    expect(await violations(mount(VueWordgard.create, decorated))).toEqual([]);
  });

  it("keeps Wordgard's attributes on the content element", () => {
    const { contentDOM } = mount(VueWordgard.create, decorated);
    expect(contentDOM.getAttribute("role")).toBe("textbox");
    expect(contentDOM.getAttribute("aria-multiline")).toBe("true");
    expect(contentDOM.getAttribute("aria-label")).toBe("Document");
  });
});
