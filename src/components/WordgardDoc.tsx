// Named after react-prosemirror's ProseMirrorDoc, rewritten for Wordgard. The portal commits first
// and builds the tiles; attaching the element then connects the editor, as Wordgard's own editor is
// built before it's connected.
import React, {
  type HTMLAttributes,
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { Wordgard } from "wordgard/editor";

import { docPortal } from "../ReactDocTile.js";
import { useEditorContext } from "../contexts/EditorContext.js";
import { editorOf } from "../editorStore.js";

const DocPortal = ({ wg }: { wg: Wordgard }) => {
  const portal = docPortal(wg.contentDOM);
  const element = useSyncExternalStore(portal.subscribe, portal.get);
  // Insertion effects all run before any layout effect, so a second portal
  // committed alongside this one has claimed the editor by the time `mount`
  // builds the tiles. StrictMode doesn't run them twice.
  useInsertionEffect(() => portal.claim(), [portal]);
  useLayoutEffect(() => portal.committed(element));
  useLayoutEffect(() => portal.mount(), [portal]);
  return createPortal(element, wg.contentDOM);
};

type Props = Omit<HTMLAttributes<HTMLDivElement>, "children">;

/**
 * Puts the editor in the page, inside a `div` taking the props, and renders the document through a
 * portal, in your React tree. It goes under its `<WordgardEditor>`, inside any other components,
 * with other children before or after it. One per editor: a second throws.
 */
export const WordgardDoc = (props: Props) => {
  const { wg } = useEditorContext();
  const attach = useCallback(
    (dom: HTMLDivElement | null) => {
      if (!dom) return;
      dom.appendChild(wg.dom);
      // Effects waiting for the editor to be in the page.
      editorOf(wg).requestEffects();
    },
    [wg]
  );
  return (
    <>
      <DocPortal wg={wg} />
      <div {...props} ref={attach} />
    </>
  );
};
