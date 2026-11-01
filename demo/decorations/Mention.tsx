// A mention: an inline node drawn by a React widget, which shows a card for
// the person while it's selected (click it, or move onto it).
import React, { forwardRef } from "react";

import {
  type WidgetViewComponentProps,
  createWidgetType,
  useIsNodeSelected,
} from "../../src/index.js";
import { people } from "../schema.js";

const MentionView = forwardRef<HTMLSpanElement, WidgetViewComponentProps<string, HTMLSpanElement>>(
  ({ value, className, ...attrs }, ref) => {
    const selected = useIsNodeSelected();
    const person = people[value];
    return (
      <span {...attrs} ref={ref} className={`mention ${className ?? ""}`}>
        @{person?.name ?? value}
        {selected && person && (
          <span className="mention-card" aria-hidden="true">
            <strong>{person.name}</strong>
            <span>{person.role}</span>
          </span>
        )}
      </span>
    );
  }
);

export const MentionWidget = createWidgetType<string, HTMLSpanElement>({
  render: (id) => {
    const span = document.createElement("span");
    span.className = "mention";
    span.textContent = `@${people[id]?.name ?? id}`;
    return span;
  },
  component: MentionView,
});
