// The benchmark's documents: seeded, so every editor and every run gets the
// same one. About 100 words a paragraph, five paragraphs to an A4 page: 50,
// 500, 1,500 and 5,000 paragraphs are about 10, 100, 300 and 1,000 pages.
// Each paragraph has 2 to 5 marked runs (bold, italic, a link, a colour) and
// the search term once, inside a marked run in every fourth paragraph.

export const searchTerm = "acme";
export const replacement = "Acme Corporation";

const words =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(
    " "
  );
const wordsPerParagraph = 100;

// mulberry32: a small seeded generator.
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const markTags = [
  ["<strong>", "</strong>"],
  ["<em>", "</em>"],
  ['<a href="https://example.com/">', "</a>"],
  ['<span style="color: #c0392b">', "</span>"],
] as const;

const paragraph = (next: () => number, index: number) => {
  const pick = (n: number) => Math.floor(next() * n);
  const text = Array.from({ length: wordsPerParagraph }, () => words[pick(words.length)] ?? "");
  // Marked runs of 1 to 4 words, apart from each other.
  const runs: { from: number; to: number; tags: (typeof markTags)[number] }[] = [];
  const count = 2 + pick(4);
  const slot = Math.floor(wordsPerParagraph / count);
  for (let i = 0; i < count; i++) {
    const from = i * slot + pick(slot - 5);
    runs.push({
      from,
      to: from + 1 + pick(4),
      tags: markTags[pick(markTags.length)] ?? markTags[0],
    });
  }
  const marked = (w: number) => runs.some((r) => w >= r.from && w < r.to);
  let term = index % 4 == 0 ? (runs[0]?.from ?? 0) : pick(wordsPerParagraph);
  if (index % 4) while (marked(term)) term = (term + 1) % wordsPerParagraph;
  text[term] = searchTerm;
  const out: string[] = [];
  for (let w = 0; w < text.length; w++) {
    const run = runs.find((r) => r.from == w);
    const end = runs.find((r) => r.to == w);
    if (end) out.push(end.tags[1]);
    if (w) out.push(" ");
    if (run) out.push(run.tags[0]);
    out.push(text[w] ?? "");
  }
  const last = runs.find((r) => r.to >= text.length);
  if (last) out.push(last.tags[1]);
  return `<p>${out.join("")}</p>`;
};

// For setting the font size everywhere: every word styled, in 6 runs of
// differing size and colour, as formatted documents imported from Word are.
// In ProseMirror, a step a run: about 6 a paragraph.
const sizes = ["11px", "12px", "13px", "15px", "16px", "18px"];
const colors = ["#c0392b", "#2c3e50", "#16a085", "#8e44ad", "#d35400", "#2980b9"];
const runsPerParagraph = 6;

const styledParagraph = (next: () => number) => {
  const pick = (n: number) => Math.floor(next() * n);
  const text = Array.from({ length: wordsPerParagraph }, () => words[pick(words.length)] ?? "");
  const per = wordsPerParagraph / runsPerParagraph;
  const runs = Array.from({ length: runsPerParagraph }, (_, r) => {
    const run = text.slice(Math.round(r * per), Math.round((r + 1) * per)).join(" ");
    const style = `font-size: ${sizes[pick(sizes.length)]}; color: ${colors[pick(colors.length)]}`;
    return `<span style="${style}">${r ? " " : ""}${run}</span>`;
  });
  return `<p>${runs.join("")}</p>`;
};

const cache = new Map<string, string>();
const generate = (key: string, n: number, f: (next: () => number, i: number) => string) => {
  let html = cache.get(key);
  if (html == null) {
    const next = random(n);
    html = Array.from({ length: n }, (_, i) => f(next, i)).join("");
    cache.set(key, html);
  }
  return html;
};

// The document's HTML, `n` paragraphs.
export const documentHTML = (n: number) => generate(`plain/${n}`, n, paragraph);

// The styled document's HTML, `n` paragraphs.
export const styledHTML = (n: number) => generate(`styled/${n}`, n, styledParagraph);
