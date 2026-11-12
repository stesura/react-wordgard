// A floating formatting toolbar over a text selection, after Stesura's text
// menu, simplified: marks only, shown once the mouse is up.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import type { Mark } from "wordgard/doc";
import { Command, canAddMarkInRange, toggleMark } from "wordgard/command";
import { link } from "wordgard/schema";
import { GardSelection, type GardState } from "wordgard/state";
import {
  BackgroundColor,
  Code,
  Emphasis,
  Link,
  Strikethrough,
  Strong,
  Underline,
} from "wordgard/types";

import {
  useEditorEventCallback,
  useEditorEventListener,
  useEditorStateSelector,
} from "@stesura/react-wordgard";
import { useFloatingAt } from "./useFloatingAt.js";

const buttons: { label: string; title: string; mark: Mark }[] = [
  { label: "B", title: "Bold", mark: Strong },
  { label: "I", title: "Italic", mark: Emphasis },
  { label: "U", title: "Underline", mark: Underline },
  { label: "S", title: "Strikethrough", mark: Strikethrough },
  { label: "</>", title: "Code", mark: Code },
  { label: "H", title: "Highlight", mark: BackgroundColor.of("#fde68a") },
];

// As Wordgard's mark buttons: active when no selected text could take it.
const isActive = (state: GardState, mark: Mark) =>
  !state.selection.ranges.some((r) => canAddMarkInRange(state.doc, r.from, r.to, mark));

const hasLink = (state: GardState) => {
  let found = false;
  for (const { from, to } of state.selection.ranges)
    state.doc.iterate(from, to, (node) => {
      if (Link.isInSet(node.marks)) found = true;
      return !found;
    });
  return found;
};

export const TextMenu = () => {
  const [focused, setFocused] = useState(false);
  const [pointerDown, setPointerDown] = useState(false);
  useEditorEventListener("focus", () => {
    setFocused(true);
    return false;
  });
  useEditorEventListener("blur", () => {
    setFocused(false);
    return false;
  });
  // Not while a mouse selection is being made: the mouseup may land outside
  // the editor.
  useEditorEventListener("mousedown", () => {
    setPointerDown(true);
    addEventListener("mouseup", () => setPointerDown(false), { once: true });
    return false;
  });

  const from = useEditorStateSelector((state) =>
    state.selection.empty || state.selection instanceof GardSelection.Node
      ? null
      : state.selection.from
  );
  const open = focused && !pointerDown && from != null;
  // One character per button, so the selector's result compares by value.
  const active = useEditorStateSelector((state) =>
    open ? buttons.map(({ mark }) => (isActive(state, mark) ? "1" : "0")).join("") : ""
  );
  const linked = useEditorStateSelector((state) => open && hasLink(state));
  const coords = useFloatingAt(open ? from : null);

  const toggle = useEditorEventCallback((wg, mark: Mark) => {
    Command.dispatch(wg, toggleMark, mark);
  });
  const toggleLink = useEditorEventCallback((wg) => {
    Command.dispatch(wg, link.button.run);
  });

  if (!coords) return null;
  return createPortal(
    <div
      className="text-menu"
      role="toolbar"
      aria-label="Text formatting"
      style={{ left: coords.left, top: coords.top }}
      // Keeps the editor's focus and selection.
      onMouseDown={(event) => event.preventDefault()}
    >
      {buttons.map(({ label, title, mark }, i) => (
        <button
          key={title}
          type="button"
          title={title}
          aria-pressed={active[i] == "1"}
          onClick={() => toggle(mark)}
        >
          {label}
        </button>
      ))}
      <button type="button" title="Link" aria-pressed={linked} onClick={toggleLink}>
        🔗
      </button>
    </div>,
    document.body
  );
};
