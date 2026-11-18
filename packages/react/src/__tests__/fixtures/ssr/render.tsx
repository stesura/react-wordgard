// Loaded on the server, through the test project's Vite server (vite.config.ts's `renderReactOnServer`
// command): Page as a framework renders it there.
import React from "react";
import { renderToString } from "react-dom/server";

import { Page } from "./Page.js";

export default () => ({ body: renderToString(<Page />) });
