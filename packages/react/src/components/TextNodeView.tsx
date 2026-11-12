// Named after react-prosemirror's TextNodeView, rewritten for Wordgard: a bare text node, whose
// tile ReactDocTile builds after the commit.
import { memo } from "react";

type Props = {
  text: string;
};

export const TextNodeView = memo(({ text }: Props) => text);
