// A callout after Stesura's (its CalloutNodeView and title bar): a title bar
// of chrome above the content. The icon picks the kind, a double-click on the
// title edits it. Simplified: a plain popover for the kind menu, no slots.
import React, { useRef, useState } from "react";

import {
  DecorationRoot,
  createShape,
  useEditorEventCallback,
  useNodePos,
  useStopEvent,
} from "@stesura/react-wordgard";
import {
  CalloutKind,
  type CalloutKindName,
  CalloutTitle,
  calloutKinds,
  isCalloutKind,
} from "../schema.js";

const kindNames = Object.keys(calloutKinds).filter(isCalloutKind);

// Drawn with DecorationRoot: the callout type's own <aside class="callout">.
export const CalloutShape = createShape(function Callout({
  nodeProps: { node, contentDOMRef },
  children,
}) {
  const kind = node.tag.mark(CalloutKind) ?? "note";
  const title = node.tag.mark(CalloutTitle);
  const getPos = useNodePos();

  // The bar's events are its controls', not the editor's.
  const barRef = useRef<HTMLDivElement>(null);
  useStopEvent(
    (_wg, event) => event.target instanceof Node && !!barRef.current?.contains(event.target)
  );

  const setKind = useEditorEventCallback((wg, next: CalloutKindName) => {
    wg.dispatch({ changes: { from: getPos(), add: CalloutKind.of(next) } });
    wg.focus();
  });
  // `null` cancels; a blur doesn't pull the focus back from where it went.
  const finishTitle = useEditorEventCallback((wg, next: string | null, refocus: boolean) => {
    const from = getPos();
    if (next && next != title) wg.dispatch({ changes: { from, add: CalloutTitle.of(next) } });
    else if (next == "" && title)
      wg.dispatch({ changes: { from, remove: CalloutTitle.of(title) } });
    if (refocus) wg.focus();
  });

  return (
    <DecorationRoot data-kind={kind}>
      <div ref={barRef} className="callout-title">
        <KindPicker kind={kind} onPick={setKind} />
        <Title title={title} placeholder={calloutKinds[kind].label} onFinish={finishTitle} />
      </div>
      <div className="callout-body" ref={contentDOMRef}>
        {children}
      </div>
    </DecorationRoot>
  );
});

const KindPicker = ({
  kind,
  onPick,
}: {
  kind: CalloutKindName;
  onPick: (kind: CalloutKindName) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="callout-kind"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label="Callout kind"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {calloutKinds[kind].icon}
      </button>
      {open && (
        <span className="popover" role="menu">
          {kindNames.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitemradio"
              aria-checked={name == kind}
              onClick={() => {
                setOpen(false);
                onPick(name);
              }}
            >
              {calloutKinds[name].icon} {calloutKinds[name].label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

type Finish = (title: string | null, refocus: boolean) => void;

const Title = ({
  title,
  placeholder,
  onFinish,
}: {
  title: string | undefined;
  placeholder: string;
  onFinish: Finish;
}) => {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <TitleField
      title={title}
      placeholder={placeholder}
      onFinish={(draft, refocus) => {
        setEditing(false);
        onFinish(draft, refocus);
      }}
    />
  ) : (
    <span title="Double-click to rename" onDoubleClick={() => setEditing(true)}>
      {title ?? placeholder}
    </span>
  );
};

// Enter and blur commit, Escape cancels.
const TitleField = ({
  title,
  placeholder,
  onFinish,
}: {
  title: string | undefined;
  placeholder: string;
  onFinish: Finish;
}) => {
  const [draft, setDraft] = useState(title ?? "");
  // Enter and Escape finish before the blur that unmounting may cause.
  const finished = useRef(false);
  const finish = (value: string | null, refocus: boolean) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(value?.trim() ?? null, refocus);
  };
  return (
    <input
      aria-label="Callout title"
      placeholder={placeholder}
      value={draft}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(draft, false)}
      onKeyDown={(event) => {
        if (event.key == "Enter" || event.key == "Escape") {
          event.preventDefault();
          finish(event.key == "Enter" ? draft : null, true);
        }
      }}
    />
  );
};
