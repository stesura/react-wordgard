// Setup for the `browser` and `view` projects: skips, in one browser, the copied
// Wordgard tests that fail there on plain Wordgard too.
import type { TestContext } from "vitest";
import { server } from "vitest/browser";

// A test's name as Vitest prints it: file > describe > it.
export const testName = (context: TestContext) => {
  const names = [context.task.name];
  for (let suite = context.task.suite; suite; suite = suite.suite) names.unshift(suite.name);
  names.unshift(context.task.file.name.replace(/.*\//, ""));
  return names.join(" > ");
};

const failing: Record<string, string[]> = {
  // Moving up from "t|wo" lands one character left (1, not 2). Seen in
  // Playwright's WebKit on Windows; to check in Safari before calling it
  // Wordgard's.
  webkit: ["webtest-coords.ts > moveVertically > can move between paragraphs"],
};

const skipped = new Set(failing[server.browser] ?? []);

beforeEach((context) => {
  if (skipped.has(testName(context))) context.skip();
});
