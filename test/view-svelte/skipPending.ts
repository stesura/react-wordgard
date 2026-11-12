// Setup for the `view-svelte` project: React's pending list (test/view/pending.ts), less the tests
// the Svelte view passes. Its DOM is its own: a wrapper element of another tag takes the old one's
// children, as Wordgard's update does.
import { testName } from "../skipInBrowser.js";
import { pendingWordgardTests } from "../view/pending.js";

const passes = new Set([
  "webtest-content.ts > DocTile > preserves DOM nodes with changed wrappers marks",
]);

const pending = new Set<string>(
  Object.values(pendingWordgardTests)
    .flat()
    .filter((name) => !passes.has(name))
);

beforeEach((context) => {
  if (pending.has(testName(context))) context.skip();
});
