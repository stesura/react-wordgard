// Copies Wordgard's reference for agents from react-wordgard's skill into vue-wordgard's, which
// ships it too: one copy in the repository, run as vue-wordgard's prepack.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packages = resolve(dirname(fileURLToPath(import.meta.url)), "..", "packages");
const from = resolve(packages, "react/skills/react-wordgard/references/wordgard.md");
const to = resolve(packages, "vue/skills/vue-wordgard/references/wordgard.md");
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
