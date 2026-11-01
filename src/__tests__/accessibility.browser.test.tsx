// Accessibility (docs/open-points.md): axe-core's checks over editors drawn by
// React, compared with plain Wordgard drawing the same document, and with
// React shapes, marks and widgets in it. Wordgard's own ARIA attributes (the
// content element's role, label, multiline) must survive React's drawing.
import axe from "axe-core";
import React, { forwardRef } from "react";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Image, Link } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { type MarkViewComponentProps, reactMark } from "../decorations/ReactMarkType.js";
import { type ShapeViewComponentProps, reactShape } from "../decorations/ReactShapeType.js";
import { type WidgetViewComponentProps, reactWidget } from "../decorations/ReactWidgetType.js";

// A callout as the README advises: its decorative icon hidden, its control
// labelled.
const Callout = forwardRef<HTMLElement, ShapeViewComponentProps>(
  ({ nodeProps: { contentDOMRef }, children, ...attrs }, ref) => (
    <aside {...attrs} ref={ref}>
      <span aria-hidden="true">!</span>
      <button type="button" aria-label="Collapse">
        -
      </button>
      <div ref={contentDOMRef}>{children}</div>
    </aside>
  )
);

const LinkView = forwardRef<HTMLAnchorElement, MarkViewComponentProps<HTMLAnchorElement>>(
  ({ markProps: { mark, contentDOMRef }, children }, ref) => (
    <a ref={ref} href={String(mark.value)}>
      <span ref={contentDOMRef}>{children}</span>
    </a>
  )
);

const Picture = reactWidget({
  render: () => document.createElement("img"),
  component: forwardRef<HTMLImageElement, WidgetViewComponentProps<null>>(
    ({ value: _, ...attrs }, ref) => <img {...attrs} ref={ref} src="data:," alt="A picture" />
  ),
});

const doc =
  '<h1>Title</h1><p>a <strong>b</strong> <a href="https://example.com">c</a> <img src="data:," alt="d"></p><blockquote><p>e</p></blockquote>';
// The label on the content element, the textbox: `Wordgard.label` puts it on
// the editor's outer element (docs/wordgard-upstream-bugs.md, 11).
const plain: GardState.Extension = [
  basicSchema(),
  blockquote(),
  image(),
  Wordgard.contentAttributes.of({ "aria-label": "Document" }),
];
const decorated: GardState.Extension = [
  plain,
  Decoration.Tag.shape(Blockquote, reactShape({ component: Callout, element: "aside" })),
  Decoration.Mark.shape(Link, reactMark({ component: LinkView, element: "a" })),
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

describe("Accessibility", () => {
  it("breaks no rule, as plain Wordgard on the same document", async () => {
    expect(await violations(mount(Wordgard.create, plain))).toEqual([]);
    expect(await violations(mount(ReactWordgard.create, plain))).toEqual([]);
  });

  it("breaks no rule with React shapes, marks and widgets drawn as the README advises", async () => {
    expect(await violations(mount(ReactWordgard.create, decorated))).toEqual([]);
  });

  it("keeps Wordgard's attributes on the content element", () => {
    const { contentDOM } = mount(ReactWordgard.create, decorated);
    expect(contentDOM.getAttribute("role")).toBe("textbox");
    expect(contentDOM.getAttribute("aria-multiline")).toBe("true");
    expect(contentDOM.getAttribute("aria-label")).toBe("Document");
  });
});
