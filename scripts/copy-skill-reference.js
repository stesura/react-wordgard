// Copies Wordgard's reference for agents from react-wordgard's skill into another view's (vue or
// svelte, the argument), which ships it too: one copy in the repository, run as that view's
// prepack.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const view = process.argv[2];
if (view != "vue" && view != "svelte") {
  console.error("Usage: node scripts/copy-skill-reference.js vue|svelte");
  process.exit(1);
}
const packages = resolve(dirname(fileURLToPath(import.meta.url)), "..", "packages");
const from = resolve(packages, "react/skills/react-wordgard/references/wordgard.md");
const to = resolve(packages, `${view}/skills/${view}-wordgard/references/wordgard.md`);
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
