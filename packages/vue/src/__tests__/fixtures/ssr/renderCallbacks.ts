// As render.ts, for the callback-order page.
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

import { Callbacks } from "./Callbacks.js";

export default async () => ({ body: await renderToString(createSSRApp(Callbacks)) });
