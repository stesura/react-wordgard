// A link drawn by React: hovering it shows a card with its target, chrome
// beside the marked text.
import React, { forwardRef, useState } from "react";

import { type MarkComponentProps, createMarkShape, useStopEvent } from "@stesura/react-wordgard";

const LinkView = forwardRef<HTMLAnchorElement, MarkComponentProps<HTMLAnchorElement>>(
  ({ markProps: { mark, contentDOMRef }, children, ...props }, ref) => {
    const [hover, setHover] = useState(false);
    const href = String(mark.value);
    useStopEvent(
      (_wg, event) => event.target instanceof Element && !!event.target.closest(".link-card")
    );
    return (
      <a
        {...props}
        ref={ref}
        href={href}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span ref={contentDOMRef}>{children}</span>
        {hover && (
          <span className="link-card">
            <span>{new URL(href, location.href).host}</span>
            <button type="button" onClick={() => window.open(href, "_blank", "noopener")}>
              Open
            </button>
          </span>
        )}
      </a>
    );
  }
);

export const LinkShape = createMarkShape(LinkView, { element: "a" });
