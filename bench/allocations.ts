// Browser commands (run in Node): Chromium's sampling heap profiler through the
// DevTools protocol, counting objects garbage collected while it runs too, so
// it estimates the bytes allocated between start and stop, freed or not.
import type { BrowserCommand } from "vitest/node";

type ProfileNode = { selfSize: number; children: ProfileNode[] };

let stop: (() => Promise<number>) | null = null;

const total = (node: ProfileNode): number =>
  node.children.reduce((sum, child) => sum + total(child), node.selfSize);

export const allocationsStart: BrowserCommand<[]> = async ({ page, context }) => {
  if (stop) throw new Error("The heap profiler is already running");
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.startSampling", {
    samplingInterval: 16384,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  stop = async () => {
    try {
      const { profile } = await cdp.send("HeapProfiler.stopSampling");
      return total(profile.head);
    } finally {
      await cdp.detach();
    }
  };
};

// The bytes allocated since `allocationsStart`, in MB.
export const allocationsStop: BrowserCommand<[], number> = async () => {
  const running = stop;
  if (!running) throw new Error("The heap profiler isn't running");
  stop = null;
  return (await running()) / 1e6;
};
