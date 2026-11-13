// Adapted from Wordgard's "can handle random changes" test (test/wordgard/webtest-content.ts) and
// its generator (test/wordgard/generate.ts) for Svelte decorations: random documents with Svelte
// shapes, wrappers, marks and widgets in them, random edits, and between them random changes of
// the components' own state. After each step, the tiles and DOM must be a fresh editor's for the
// same state, its components starting as the edited editor's are. Seeded: a failure names its
// seed and the steps that led to it.
import { flushSync, tick } from "svelte";
import { type ChangeSet, Leaf, type Mark, Plot } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import {
  basicSchema,
  blockquote,
  bulletList,
  codeBlock,
  image,
  orderedList,
} from "wordgard/schema";
import { GardState, Transaction } from "wordgard/state";
import { Blockquote, Emphasis, Heading, Image, Link, Paragraph, Strong } from "wordgard/types";

import { drawn, flushKeeps, typeInto } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import { createWrapper } from "../decorations/SvelteWrapperType.js";
import Callout from "./fixtures/random/Callout.svelte";
import Counter from "./fixtures/random/Counter.svelte";
import Frame from "./fixtures/random/Frame.svelte";
import HeadingView from "./fixtures/random/Heading.svelte";
import LinkMark from "./fixtures/random/LinkMark.svelte";
import { type State, mounted, pending } from "./fixtures/random/mounted.js";
import Picture from "./fixtures/shape/Picture.svelte";

// To replay a failure: `firstSeed` its seed, `seeds` 1.
const firstSeed = 1;
const seeds = 20;
const steps = 30;

// mulberry32.
const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

let random = seeded(firstSeed);
const r = (n: number) => Math.floor(random() * n);
const pick = <T>(items: readonly T[]): T | undefined => items[r(items.length)];
const rWord = (length = 1 + r(4)) =>
  Array.from({ length }, () => String.fromCharCode(97 + r(26))).join("");

// Point widgets: one in every other textblock, at most four, their values "index.version".
const bump = Transaction.Effect.define<number>();
const versions = GardState.Field.define<readonly number[]>({
  create: () => [0, 0, 0, 0],
  update: (value, tr) => {
    for (const effect of tr.effects)
      if (effect.is(bump)) value = value.map((v, i) => (i == effect.value ? v + 1 : v));
    return value;
  },
});
const CounterType = createWidgetType<string>({ component: Counter, element: "button" });
const counters = Decoration.Point.source.of((state) => {
  const at = state.field(versions);
  return Decoration.Point.set((add) =>
    textblocks(state.doc)
      .filter((_, k) => k % 2 == 0)
      .slice(0, at.length)
      .forEach(({ node, pos }, i) =>
        add(
          Decoration.Point.widget(CounterType.of(`${i}.${at[i]}`)),
          pos + 1 + ((i * 7) % (node.contentLength + 1))
        )
      )
  );
});

const config = [
  basicSchema(),
  blockquote(),
  bulletList(),
  orderedList(),
  codeBlock(),
  image(),
  versions,
  counters,
  Decoration.Tag.shape(Blockquote, createShape(Callout).of("div")),
  Decoration.Tag.shape(Heading, createShape(HeadingView)),
  Decoration.Tag.wrapper(Paragraph, createWrapper(Frame, { element: "section" })),
  Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
  Decoration.Tag.shape(
    Image,
    createWidgetType<null>({ component: Picture, element: "img" }).of(null)
  ),
];

// A random document, as Wordgard's rDoc builds one, in HTML.
const rInline = () =>
  Array.from({ length: r(6) }, () => {
    const roll = r(10);
    return roll < 5
      ? rWord()
      : roll == 5
        ? `<strong>${rWord()}</strong>`
        : roll == 6
          ? `<em>${rWord()}</em>`
          : roll == 7
            ? `<a href="/${rWord()}">${rWord()} <em>${rWord()}</em></a>`
            : roll == 8
              ? '<img src="data:,">'
              : "<br>";
  }).join(" ");
const rBlocks = (depth: number): string =>
  Array.from({ length: 1 + r(3) }, () => {
    const roll = r(10);
    if (depth < 2 && roll == 0) return `<blockquote>${rBlocks(depth + 1)}</blockquote>`;
    if (depth < 2 && roll == 1) {
      const list = r(2) ? "ul" : "ol";
      const items = Array.from({ length: 1 + r(2) }, () => `<li>${rBlocks(depth + 1)}</li>`);
      return `<${list}>${items.join("")}</${list}>`;
    }
    if (roll < 4) {
      const level = 1 + r(3);
      return `<h${level}>${rInline()}</h${level}>`;
    }
    if (roll == 4) return `<pre>${rWord()}</pre>`;
    return `<p>${rInline()}</p>`;
  }).join("");

type Block = { node: Plot; pos: number; parent: Plot; index: number };

const blocksOf = (doc: Plot) => {
  const found: Block[] = [];
  const explore = (node: Plot, start: number) => {
    let pos = start;
    node.content.forEach((child, index) => {
      if (child instanceof Plot) {
        found.push({ node: child, pos, parent: node, index });
        if (!child.inlineContent) explore(child, pos + 1);
      }
      pos += child.length;
    });
  };
  explore(doc, 0);
  return found;
};

const textblocks = (doc: Plot) => blocksOf(doc).filter(({ node }) => node.isTextblock);

type Edit = { what: string; spec: ChangeSet.Spec };

// Wordgard's change generators, and retagging a textblock, inserting a block or an image.
const generators: ((doc: Plot.Doc) => Edit | null | undefined)[] = [
  (doc) => {
    const block = pick(textblocks(doc));
    if (!block) return null;
    const at = block.pos + 1 + r(block.node.contentLength + 1);
    const text = rWord();
    return { what: `insert "${text}" at ${at}`, spec: { from: at, insert: [Leaf.text(text)] } };
  },
  (doc) => {
    const block = pick(textblocks(doc).filter(({ node }) => node.contentLength));
    if (!block) return null;
    const end = block.pos + 1 + block.node.contentLength;
    const from = block.pos + 1 + r(block.node.contentLength);
    const to = Math.min(end, from + 1 + r(3));
    return { what: `delete ${from}-${to}`, spec: { from, to } };
  },
  (doc) => {
    const block = pick(
      blocksOf(doc).filter(({ node, parent, index }) => {
        const prev = parent.content[index - 1];
        return (
          prev instanceof Plot &&
          node.content.every((child) => doc.schema.canContain(prev.type, child.type))
        );
      })
    );
    return (
      block && { what: `join at ${block.pos}`, spec: { from: block.pos - 1, to: block.pos + 1 } }
    );
  },
  (doc) => {
    const block = pick(
      blocksOf(doc).filter(({ node, parent }) => doc.schema.sharesContent(parent.type, node.type))
    );
    if (!block) return null;
    const end = block.pos + block.node.length;
    return {
      what: `lift ${block.pos}`,
      spec: [
        { from: block.pos, to: block.pos + 1 },
        { from: end - 1, to: end },
      ],
    };
  },
  (doc) => {
    const block = pick(
      blocksOf(doc).filter(
        ({ node, parent }) =>
          doc.schema.canContain(parent.type, Blockquote.type) &&
          doc.schema.canContain(Blockquote.type, node.type)
      )
    );
    if (!block) return null;
    return {
      what: `wrap ${block.pos} in a blockquote`,
      spec: [
        { from: block.pos, insert: [Blockquote] },
        { from: block.pos + block.node.length, insert: [Plot.End] },
      ],
    };
  },
  (doc) => {
    const block = pick(blocksOf(doc).filter(({ parent }) => parent.content.length > 1));
    if (!block) return null;
    const to = block.pos + block.node.length;
    return { what: `delete ${block.pos}-${to}`, spec: { from: block.pos, to } };
  },
  (doc) => {
    const length = 2 + r(6);
    const from = r(Math.max(1, doc.length - length));
    const to = Math.min(doc.length, from + length);
    const mark = pick([Strong, Emphasis, Link.of(`/${rWord()}`), Link.of(`/${rWord()}`)]);
    return mark && { what: `add ${mark} to ${from}-${to}`, spec: { from, to, add: mark } };
  },
  (doc) => {
    const found: { block: Block; mark: Mark }[] = [];
    for (const block of textblocks(doc))
      for (const child of block.node.content)
        for (const mark of child.marks) found.push({ block, mark });
    const one = pick(found);
    if (!one) return null;
    const { block, mark } = one;
    const to = block.pos + block.node.length;
    return {
      what: `remove ${mark} from ${block.pos}-${to}`,
      spec: { from: block.pos, to, remove: mark },
    };
  },
  (doc) => {
    const block = pick(
      textblocks(doc).filter(({ node }) => node.tag == Paragraph || node.type == Heading)
    );
    if (!block) return null;
    const tag = r(4) ? Heading.of(1 + r(3)) : Paragraph;
    return {
      what: `retag ${block.pos} as ${tag}`,
      spec: { from: block.pos, to: block.pos + 1, insert: [tag] },
    };
  },
  (doc) => {
    const block = pick(blocksOf(doc));
    if (!block) return null;
    const text = [Leaf.text(rWord())];
    const roll = r(3);
    const node =
      roll == 0
        ? Paragraph.create(text)
        : roll == 1
          ? Heading.of(1 + r(3)).create(text)
          : Blockquote.create([Paragraph.create(text)]);
    if (!doc.schema.canContain(block.parent.type, node.type)) return null;
    const at = r(2) ? block.pos : block.pos + block.node.length;
    return { what: `insert ${node} at ${at}`, spec: { from: at, insert: [node] } };
  },
  (doc) => {
    const block = pick(
      textblocks(doc).filter(({ node }) => doc.schema.canContain(node.type, Image))
    );
    if (!block) return null;
    const at = block.pos + 1 + r(block.node.contentLength + 1);
    return { what: `insert an image at ${at}`, spec: { from: at, insert: [Image.of("data:,")] } };
  },
];

const rEdit = (doc: Plot.Doc) => {
  for (let i = 0; i < 100; i++) {
    const edit = pick(generators)?.(doc);
    if (edit) return edit;
  }
  throw new Error(`No edit for ${doc}`);
};

const edit = (wg: Wordgard) => {
  const { what, spec } = rEdit(wg.state.doc);
  wg.dispatch({ changes: { correct: spec } });
  return what;
};

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  mounted.clear();
  pending.clear();
});

const create = (spec: { doc: string } | { state: GardState }) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = SvelteWordgard.create(
    "state" in spec ? { ...spec, parent } : { ...spec, config, parent }
  );
  wg.flush();
  editors.push(wg);
  return wg;
};

const mountedIn = (wg: Wordgard) => [...(mounted.get(wg) ?? [])];

const drop = (wg: Wordgard) => {
  wg.dom.remove();
  mounted.delete(wg);
  editors.splice(editors.indexOf(wg), 1);
};

// What a fresh editor draws for the same state, its components given the state of `wg`'s at the
// same place, and the components either editor has and the other hasn't. Components don't mount
// in document order (a shape's content after it), so a first fresh editor gives the order.
const fresh = (wg: Wordgard) => {
  const probe = create({ state: wg.state });
  const order = mountedIn(probe).map(({ kind, at }) => ({ kind, at: at() }));
  drop(probe);
  const edited = new Map(mountedIn(wg).map(({ kind, at, state }) => [`${kind}@${at()}`, state]));
  const misplaced: string[] = [];
  for (const { kind, at } of order) {
    const state = edited.get(`${kind}@${at}`);
    if (!state) misplaced.push(`${kind}@${at} only in a fresh editor`);
    edited.delete(`${kind}@${at}`);
    pending.set(kind, [...(pending.get(kind) ?? []), { at, state: { ...state } }]);
  }
  for (const key of edited.keys()) misplaced.push(`${key} only in the edited editor`);
  const other = create({ state: wg.state });
  for (const { kind, at, expected } of mountedIn(other))
    if (at() !== expected) misplaced.push(`${kind}@${at()} given ${kind}@${expected}'s state`);
  pending.clear();
  const found = drawn(other);
  drop(other);
  return { found, misplaced };
};

// Svelte's anchors in the document outside chrome: a comment, or an empty text node, with no
// tile (as svelteDecorations.browser.test.ts's, not looking in chrome, which the view makes
// uneditable).
const anchorsIn = (wg: Wordgard) => {
  const found: string[] = [];
  const walk = (element: Element) => {
    for (const child of element.childNodes) {
      if (child instanceof Comment || (child instanceof Text && !child.length))
        if (!child.wgTile) found.push(`${element.localName} > ${child.nodeName}`);
      if (child instanceof Element && child.getAttribute("contenteditable") != "false") walk(child);
    }
  };
  walk(wg.contentDOM);
  return found;
};

// A component's state changed: committed by Svelte's microtask (Wordgard's DOM observer's after
// it), by flushSync, or after an edit, before the editor's flush.
const changeComponent = async (wg: Wordgard) => {
  const component = pick(mountedIn(wg));
  const name = component && pick(Object.keys(component.state));
  if (!component || !name) return "no component";
  const { state } = component;
  const old = state[name];
  const value: State[string] =
    typeof old == "boolean" ? !old : typeof old == "number" ? old + 1 : rWord();
  state[name] = value;
  const what = `${component.kind}@${component.at()} ${name} = ${value}`;
  const how = r(3);
  if (how == 0) {
    await tick();
    await Promise.resolve();
    wg.flush();
    return `${what}, awaited`;
  }
  if (how == 1) {
    flushSync();
    wg.flush();
    return `${what}, flushSync`;
  }
  const then = edit(wg);
  await tick();
  wg.flush();
  return `${what}, then ${then}, awaited`;
};

const typeSomewhere = (wg: Wordgard) => {
  const texts: Text[] = [];
  const walker = document.createTreeWalker(wg.contentDOM, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    // Document text: chrome's has a widget tile, of no length.
    if (node instanceof Text && node.length && node.wgTile?.length == node.length) texts.push(node);
  const text = pick(texts);
  if (!text) return "no text";
  const offset = r(text.length + 1);
  const data = rWord(1 + r(2));
  const what = `type "${data}" in "${text.data}" at ${offset}`;
  typeInto(wg, text, offset, data);
  wg.flush();
  return what;
};

const step = async (wg: Wordgard) => {
  const roll = r(10);
  if (roll < 3) return changeComponent(wg);
  if (roll == 3) return typeSomewhere(wg);
  if (roll == 4) {
    const index = r(4);
    wg.dispatch({ effects: bump.of(index) });
    wg.flush();
    return `bump counter ${index}`;
  }
  const what = edit(wg);
  wg.flush();
  return what;
};

// The kinds of component the runs drew, to know the generator reaches them all.
const seen = new Set<string>();

const run = async (seed: number) => {
  random = seeded(seed);
  const doc = rBlocks(0);
  const wg = create({ doc });
  const log = [`doc ${doc}`];
  for (let i = 0; i < steps; i++) {
    log.push(await step(wg));
    for (const { kind } of mountedIn(wg)) seen.add(kind);
    const where = `seed ${seed}, step ${i}:\n${log.join("\n")}`;
    expect(anchorsIn(wg), where).toEqual([]);
    expect(flushKeeps(wg), where).toBe(true);
    const { found, misplaced } = fresh(wg);
    expect(misplaced, where).toEqual([]);
    expect(drawn(wg), where).toEqual(found);
  }
  drop(wg);
};

describe("Svelte decorations under random changes", () => {
  it("draw what a fresh editor draws after each edit and component change", async () => {
    for (let seed = firstSeed; seed < firstSeed + seeds; seed++) await run(seed);
    if (seeds > 1)
      expect([...seen].sort()).toEqual(["callout", "counter", "frame", "heading", "link"]);
  });
});
