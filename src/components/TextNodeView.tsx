// Named after react-prosemirror's TextNodeView, rewritten for Wordgard: a text
// leaf renders as a bare text node, its tile is built after the commit
// (ReactDocTile).
type Props = {
  text: string;
};

export const TextNodeView = ({ text }: Props) => text;
