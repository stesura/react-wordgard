// Adapted from react-wordgard's demo (demo/main.tsx, by way of vue-wordgard's demo/vue/main.ts) for
// Svelte: the same editor, with every kind of Svelte decoration (App.svelte, config.ts).
import "../../demo/main.css";

import { mount } from "svelte";

import App from "./App.svelte";

const target = document.getElementById("editor");
if (!target) throw new Error("No #editor element");
mount(App, { target });
