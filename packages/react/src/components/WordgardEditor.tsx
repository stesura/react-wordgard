// Named after react-prosemirror's ProseMirror component, rewritten for Wordgard. The spec is read
// once, as react-prosemirror's `defaultState`: Wordgard's editor owns its state.
import React, { type ReactNode, useState } from "react";
import type { Wordgard } from "wordgard/editor";

import { ReactWordgard } from "../ReactWordgard.js";
import { EditorContext } from "../contexts/EditorContext.js";
import { useHydrated } from "../hooks/useHydrated.js";
import { editorOf } from "@stesura/wordgard-view";

type Spec = Omit<Wordgard.Spec, "parent">;

type Props = Spec & {
  children?: ReactNode;
};

const Host = ({ children, spec }: { children?: ReactNode; spec: Spec }) => {
  const [editor] = useState(() => editorOf(ReactWordgard.host(spec)));
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
};

/**
 * Creates a Wordgard editor from the spec (`doc`, `config`, `selection`, `state`, `scrollTo`) and
 * provides it to its children. It draws no DOM of its own. The spec is read once, on mount: from
 * then on the editor owns its state (see [Accessing the state outside the
 * editor](https://github.com/stesura/react-wordgard#accessing-the-state-outside-the-editor)). In
 * React's StrictMode (development only), it creates its editor twice and drops one, which is never
 * put in the page. On the server and while the page hydrates it creates no editor and draws
 * nothing (Wordgard needs the DOM): its children appear once the page has hydrated.
 */
export const WordgardEditor = ({ children, ...spec }: Props) =>
  useHydrated() ? <Host spec={spec}>{children}</Host> : null;
