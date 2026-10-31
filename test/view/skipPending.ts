// Setup for the `view` project: skips the copied Wordgard tests listed in
// pending.ts. Skipped before they run, since a failing editor would keep
// throwing from its next flush.
import { pendingWordgardTests } from "./pending.js";

const pending = new Set<string>(Object.values(pendingWordgardTests).flat());

beforeEach((context) => {
  const names = [context.task.name];
  for (let suite = context.task.suite; suite; suite = suite.suite) names.unshift(suite.name);
  names.unshift(context.task.file.name.replace(/.*\//, ""));
  if (pending.has(names.join(" > "))) context.skip();
});
