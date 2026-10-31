// Setup for the `view` project: skips the copied Wordgard tests listed in
// pending.ts. Skipped before they run, since a failing editor would keep
// throwing from its next flush.
import { testName } from "../skipInBrowser.js";
import { pendingWordgardTests } from "./pending.js";

const pending = new Set<string>(Object.values(pendingWordgardTests).flat());

beforeEach((context) => {
  if (pending.has(testName(context))) context.skip();
});
