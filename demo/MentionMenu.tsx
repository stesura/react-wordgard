// Suggestions for a mention: typing `@` and a name lists the matching people;
// arrows move, Enter or a click inserts, Escape dismisses.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Leaf, Slice } from "wordgard/doc";
import type { GardState } from "wordgard/state";

import {
  useEditorEventCallback,
  useEditorEventListener,
  useEditorStateSelector,
} from "@stesura/react-wordgard";
import { Mention, people } from "./schema.js";
import { useFloatingAt } from "./useFloatingAt.js";

// Where the `@` is and what follows it, as "from:query", so the selector's
// result compares by value.
const trigger = (state: GardState) => {
  if (!state.selection.isCursor) return null;
  const { head } = state.sel;
  const textblock = head.textblockParent;
  if (!textblock || !state.schema.has(Mention)) return null;
  const before = Slice.get(state.doc, textblock.start, head.pos).textContent({ leafText: " " });
  const query = /(?:^|\s)@(\w*)$/.exec(before)?.[1];
  return query == null ? null : `${head.pos - query.length - 1}:${query}`;
};

export const MentionMenu = () => {
  const found = useEditorStateSelector(trigger);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  const [at, query] = found
    ? [Number(found.split(":")[0]), found.slice(found.indexOf(":") + 1)]
    : [null, ""];
  const matches = found
    ? Object.entries(people).filter(([, { name }]) =>
        name.toLowerCase().includes(query.toLowerCase())
      )
    : [];
  const open = found != null && found != dismissed && matches.length > 0;
  const selected = Math.min(index, matches.length - 1);
  const coords = useFloatingAt(open ? at : null);

  const insert = useEditorEventCallback((wg, id: string) => {
    if (at == null) return;
    wg.dispatch({
      changes: {
        from: at,
        to: wg.state.selection.from,
        insert: [Mention.of(id), Leaf.Text.of(" ")],
      },
      userEvent: "input.mention",
    });
    setIndex(0);
    wg.focus();
  });

  useEditorEventListener("keydown", (_wg, event) => {
    if (!open) return false;
    if (event.key == "ArrowDown" || event.key == "ArrowUp") {
      const step = event.key == "ArrowDown" ? 1 : -1;
      setIndex((selected + step + matches.length) % matches.length);
    } else if (event.key == "Enter" || event.key == "Tab") {
      const [id] = matches[selected] ?? [];
      if (id) insert(id);
    } else if (event.key == "Escape") {
      setDismissed(found);
    } else {
      return false;
    }
    return true;
  });

  if (!open || !coords) return null;
  return createPortal(
    <ul
      className="mention-menu"
      role="listbox"
      aria-label="People"
      style={{ left: coords.left, top: coords.bottom }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {matches.map(([id, { name, role }], i) => (
        <li key={id} role="option" aria-selected={i == selected} onClick={() => insert(id)}>
          <strong>{name}</strong> <span>{role}</span>
        </li>
      ))}
    </ul>,
    document.body
  );
};
