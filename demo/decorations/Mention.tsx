// A mention: an inline node drawn by a React widget, which shows a card for
// the person while it's selected (click it, or move onto it).
import React, { forwardRef } from "react";

import {
  type WidgetComponentProps,
  createWidgetType,
  useIsNodeSelected,
} from "@stesura/react-wordgard";
import { people } from "../schema.js";

const MentionView = forwardRef<HTMLSpanElement, WidgetComponentProps<string, HTMLSpanElement>>(
  ({ value, className, ...props }, ref) => {
    const selected = useIsNodeSelected();
    const person = people[value];
    return (
      <span {...props} ref={ref} className={`mention ${className ?? ""}`}>
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

export const MentionWidget = createWidgetType({ component: MentionView });
