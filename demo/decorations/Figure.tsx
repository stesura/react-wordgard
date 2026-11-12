// A block image resized by dragging its handles, after Stesura's
// ImageResizeFrame, simplified: width only (Wordgard's ImageSize mark), the
// image itself previews the drag, and the size commits once, on release.
import React, { type PointerEvent, forwardRef, useRef, useState } from "react";
import { ImageSize } from "wordgard/types";

import {
  type WidgetComponentProps,
  createWidgetType,
  useEditorEventCallback,
  useIsNodeSelected,
  useMergedDOMRefs,
  useNodePos,
  useStopEvent,
} from "@stesura/react-wordgard";

export type FigureValue = { src: string; alt: string | undefined; width: number | undefined };

const MIN_WIDTH = 50;

// -1 for the handles that grow the image leftwards.
const handles = [
  { name: "top-left", sign: -1 },
  { name: "top-right", sign: 1 },
  { name: "left", sign: -1 },
  { name: "right", sign: 1 },
  { name: "bottom-left", sign: -1 },
  { name: "bottom-right", sign: 1 },
];

type Drag = { pointerId: number; startX: number; startWidth: number; sign: number; width: number };

const FigureView = forwardRef<HTMLElement, WidgetComponentProps<FigureValue>>(
  ({ value: { src, alt, width }, className, ...props }, ref) => {
    const getPos = useNodePos();
    const selected = useIsNodeSelected();
    const figureRef = useRef<HTMLElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    // In a ref too: pointer moves can come before the render that follows
    // the pointerdown.
    const dragRef = useRef<Drag | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const update = (next: Drag | null) => {
      dragRef.current = next;
      setDrag(next);
    };

    // Wordgard would start a selection or a node drag from the handles.
    useStopEvent(
      (_wg, event) => event.target instanceof Element && !!event.target.closest(".resize-handle")
    );

    const commit = useEditorEventCallback((wg, next: number) => {
      wg.dispatch({
        changes: { from: getPos(), add: ImageSize.of(next) },
        userEvent: "image.resize",
      });
    });

    const start = (sign: number) => (event: PointerEvent) => {
      const img = imgRef.current;
      if (event.button != 0 || !img) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const startWidth = img.getBoundingClientRect().width;
      update({
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth,
        sign,
        width: startWidth,
      });
    };
    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId != current.pointerId) return;
      // The figure's container: the figure itself has the committed width.
      const max = figureRef.current?.parentElement?.clientWidth ?? Infinity;
      const next = current.startWidth + current.sign * (event.clientX - current.startX);
      update({ ...current, width: Math.round(Math.min(max, Math.max(MIN_WIDTH, next))) });
    };
    const end = (keep: boolean) => (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId != current.pointerId) return;
      update(null);
      if (keep && current.width != current.startWidth) commit(current.width);
    };

    const shown = drag?.width ?? width;
    return (
      <figure
        {...props}
        ref={useMergedDOMRefs(ref, figureRef)}
        className={`resizable ${selected || drag ? "active" : ""} ${className ?? ""}`}
      >
        <span className="resize-frame">
          <img ref={imgRef} src={src} alt={alt} draggable={false} style={{ width: shown }} />
          {handles.map(({ name, sign }) => (
            <span
              key={name}
              className={`resize-handle ${name}`}
              aria-hidden="true"
              onPointerDown={start(sign)}
              onPointerMove={move}
              onPointerUp={end(true)}
              onPointerCancel={end(false)}
            />
          ))}
          {drag && <span className="resize-label">{drag.width} px</span>}
        </span>
      </figure>
    );
  }
);

export const ResizableFigure = createWidgetType({
  eq: (a, b) => a.src == b.src && a.alt == b.alt && a.width == b.width,
  component: FigureView,
});
