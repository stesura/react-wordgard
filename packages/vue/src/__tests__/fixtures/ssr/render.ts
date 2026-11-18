// Loaded on the server, through a Vite server loading Vue from Node (vite.config.ts's
// `renderOnNodeServer` command): Page as Nuxt renders it there.
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

import { Page } from "./Page.js";

export default async () => ({ body: await renderToString(createSSRApp(Page)) });
