// Named after react-prosemirror's TextNodeView, rewritten for Wordgard: a text
// leaf renders as a bare text node, its tile is built after the commit
// (ReactDocTile). Skipped while its text is the same.
import { memo } from "react";

type Props = {
  text: string;
};

export const TextNodeView = memo(({ text }: Props) => text);
