// Browser commands (run in Node): Chromium's sampling CPU profiler through the
// DevTools protocol, started and stopped around what the page measures. The
// profile is summed by function (time inside it, callees included, and its own
// time) and by script file (own time).
import type { BrowserCommand } from "vitest/node";

export type CpuProfile = {
  ms: number;
  functions: { name: string; total: number; self: number }[];
  files: { name: string; self: number }[];
};

// Stops the running profiler and summarises its profile.
let stop: (() => Promise<CpuProfile>) | null = null;

// Scripts by file name, without Vite's query: the bundled dependencies are
// files of their own (React DOM, Wordgard's editor).
const fileOf = (url: string) => url.replace(/\?.*$/, "").replace(/.*\//, "") || "(native)";

const summarise = (profile: {
  nodes: {
    id: number;
    callFrame: { functionName: string; url: string; lineNumber: number };
    children?: number[];
  }[];
  samples?: number[];
  timeDeltas?: number[];
}): CpuProfile => {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  // A sample's duration is the time until the next one.
  const self = new Map<number, number>();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  let ms = 0;
  for (let i = 0; i < samples.length; i++) {
    const time = (deltas[i + 1] ?? 0) / 1000;
    const id = samples[i] ?? 0;
    self.set(id, (self.get(id) ?? 0) + time);
    ms += time;
  }
  const functions = new Map<string, { total: number; self: number }>();
  const files = new Map<string, number>();
  const active = new Map<string, number>();
  // Returns the node's time, callees included; a function on the stack twice
  // (recursion) counts its outermost call only.
  const visit = (id: number): number => {
    const node = byId.get(id);
    if (!node) return 0;
    const { functionName, url, lineNumber } = node.callFrame;
    const file = fileOf(url);
    const key = url ? `${functionName || "(anonymous)"} ${file}:${lineNumber + 1}` : functionName;
    const own = self.get(id) ?? 0;
    const depth = active.get(key) ?? 0;
    active.set(key, depth + 1);
    let total = own;
    for (const child of node.children ?? []) total += visit(child);
    active.set(key, depth);
    const entry = functions.get(key) ?? { total: 0, self: 0 };
    if (!depth) entry.total += total;
    entry.self += own;
    functions.set(key, entry);
    files.set(file, (files.get(file) ?? 0) + own);
    return total;
  };
  const root = profile.nodes[0];
  if (root) visit(root.id);
  return {
    ms,
    functions: [...functions].map(([name, times]) => ({ name, ...times })),
    files: [...files].map(([name, self]) => ({ name, self })),
  };
};

export const profileStart: BrowserCommand<[]> = async ({ page, context }) => {
  if (stop) throw new Error("The profiler is already running");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Profiler.enable");
  // In µs: a keystroke takes milliseconds.
  await cdp.send("Profiler.setSamplingInterval", { interval: 50 });
  await cdp.send("Profiler.start");
  stop = async () => {
    try {
      const { profile } = await cdp.send("Profiler.stop");
      return summarise(profile);
    } finally {
      await cdp.detach();
    }
  };
};

export const profileStop: BrowserCommand<[], CpuProfile> = async () => {
  const running = stop;
  if (!running) throw new Error("The profiler isn't running");
  stop = null;
  return running();
};
