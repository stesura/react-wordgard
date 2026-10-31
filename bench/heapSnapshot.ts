// Browser commands (run in Node): take heap snapshots of the page through the
// DevTools protocol and sum their objects' counts and sizes by class. Parsed
// as they stream: a large editor's snapshot is too long for one string.
import type { BrowserCommand } from "vitest/node";

export type HeapCounts = Record<string, { count: number; size: number }>;

const strings = (value: unknown) =>
  Array.isArray(value) && value.every((s) => typeof s == "string") ? value : null;

const field = (value: unknown, key: string): unknown =>
  typeof value == "object" && value ? Reflect.get(value, key) : undefined;

// What's needed from the snapshot's header: where each node's type, name and
// size are among its fields.
const readHeader = (json: string) => {
  const snapshot = field(JSON.parse(json), "snapshot");
  const meta = field(snapshot, "meta");
  const fields = strings(field(meta, "node_fields"));
  const nodeTypes = field(meta, "node_types");
  const types = strings(Array.isArray(nodeTypes) ? nodeTypes[0] : null);
  const count = field(snapshot, "node_count");
  if (!fields || !types || typeof count != "number")
    throw new Error("Unexpected heap snapshot header");
  return {
    types,
    count,
    width: fields.length,
    type: fields.indexOf("type"),
    name: fields.indexOf("name"),
    size: fields.indexOf("self_size"),
  };
};

// The class an object counts under. Strings are named by their content, and
// code and closures by their function: those are summed by type. Some names end
// in an object id (" @1234"), dropped.
const classOf = (type: string, fullName: string) => {
  const name = fullName.replace(/ @\d+$/, "");
  switch (type) {
    case "object":
      return name;
    case "native":
      return `native ${name}`;
    case "array":
    case "hidden":
      return name ? `(${type}) ${name}` : `(${type})`;
    case "concatenated string":
    case "sliced string":
      return "(string)";
    default:
      return `(${type})`;
  }
};
const namedTypes = new Set(["object", "native", "array", "hidden"]);

// The snapshot is one JSON object: a header, then the "nodes" array of numbers,
// then other arrays of numbers (edges, locations…), then "strings".
const snapshotParser = () => {
  let phase: "header" | "nodes" | "skip" | "strings" | "done" = "header";
  let text = "";
  let header: ReturnType<typeof readHeader> | null = null;
  let types = new Uint8Array(0);
  let names = new Uint32Array(0);
  let sizes = new Float64Array(0);
  let index = 0;
  let value = 0;
  let digits = false;
  const wanted = new Set<number>();
  const named = new Map<number, string>();
  let inString = false;
  let escaped = false;
  let raw = "";
  let stringIndex = 0;

  const stringDone = () => {
    if (wanted.has(stringIndex)) named.set(stringIndex, JSON.parse(`"${raw}"`));
    stringIndex++;
  };

  const nodes = (chunk: string, from: number) => {
    if (!header) throw new Error("No heap snapshot header");
    const { width } = header;
    for (let i = from; i < chunk.length; i++) {
      const code = chunk.charCodeAt(i);
      if (code >= 48 && code <= 57) {
        value = value * 10 + code - 48;
        digits = true;
      } else if (code == 44 || code == 93) {
        if (digits) {
          const node = Math.floor(index / width);
          const at = index % width;
          if (at == header.type) types[node] = value;
          else if (at == header.name) names[node] = value;
          else if (at == header.size) sizes[node] = value;
          index++;
        }
        value = 0;
        digits = false;
        if (code == 93) {
          for (let n = 0; n < header.count; n++)
            if (namedTypes.has(header.types[types[n] ?? 0] ?? "")) wanted.add(names[n] ?? 0);
          phase = "skip";
          return chunk.slice(i + 1);
        }
      }
    }
    return "";
  };

  const stringsFrom = (chunk: string) => {
    let i = 0;
    while (i < chunk.length) {
      if (!inString) {
        // Between strings there are only commas and whitespace.
        const code = chunk.charCodeAt(i++);
        if (code == 93) {
          phase = "done";
          return;
        }
        if (code == 34) {
          inString = true;
          raw = "";
        }
        continue;
      }
      if (escaped) {
        raw += chunk[i];
        escaped = false;
        i++;
        continue;
      }
      let end = i;
      while (end < chunk.length && chunk[end] != '"' && chunk[end] != "\\") end++;
      if (chunk[end] == "\\") {
        raw += chunk.slice(i, end + 1);
        escaped = true;
        i = end + 1;
      } else if (end < chunk.length) {
        raw += chunk.slice(i, end);
        stringDone();
        inString = false;
        i = end + 1;
      } else {
        raw += chunk.slice(i);
        return;
      }
    }
  };

  const write = (chunk: string) => {
    if (phase == "header") {
      text += chunk;
      const at = text.indexOf('"nodes":[');
      if (at == -1) return;
      header = readHeader(`${text.slice(0, at).replace(/,\s*$/, "")}}`);
      types = new Uint8Array(header.count);
      names = new Uint32Array(header.count);
      sizes = new Float64Array(header.count);
      chunk = text.slice(at + '"nodes":['.length);
      text = "";
      phase = "nodes";
    }
    if (phase == "nodes") chunk = nodes(chunk, 0);
    if (phase == "skip") {
      text += chunk;
      const at = text.indexOf('"strings":[');
      if (at == -1) {
        text = text.slice(-16);
        return;
      }
      chunk = text.slice(at + '"strings":['.length);
      text = "";
      phase = "strings";
    }
    if (phase == "strings") stringsFrom(chunk);
  };

  const counts = () => {
    if (!header || phase != "done") throw new Error("Incomplete heap snapshot");
    const result: HeapCounts = {};
    for (let n = 0; n < header.count; n++) {
      const type = header.types[types[n] ?? 0] ?? "";
      const key = classOf(type, named.get(names[n] ?? 0) ?? "");
      const entry = (result[key] ??= { count: 0, size: 0 });
      entry.count++;
      entry.size += sizes[n] ?? 0;
    }
    return result;
  };

  return { write, counts };
};

const snapshot = async ({ page, context }: Parameters<BrowserCommand>[0]) => {
  const cdp = await context.newCDPSession(page);
  try {
    const parser = snapshotParser();
    cdp.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => parser.write(chunk));
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
    return parser.counts();
  } finally {
    await cdp.detach();
  }
};

// Kept here rather than in the page, where it would count as held.
let baseline: HeapCounts = {};

export const heapBaseline: BrowserCommand<[], void> = async (context) => {
  baseline = await snapshot(context);
};

// What the page holds now that it didn't at the baseline, by class.
export const heapHeld: BrowserCommand<[], HeapCounts> = async (context) => {
  const now = await snapshot(context);
  const held: HeapCounts = {};
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(now)])) {
    const was = baseline[key] ?? { count: 0, size: 0 };
    const is = now[key] ?? { count: 0, size: 0 };
    if (is.count != was.count || is.size != was.size)
      held[key] = { count: is.count - was.count, size: is.size - was.size };
  }
  return held;
};
