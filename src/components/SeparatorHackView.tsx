// Named after react-prosemirror's SeparatorHackView, rewritten for Wordgard: the
// `<img class="wg-buffer">` Wordgard puts at the start and end of an inline plot
// (`Widget.img`), which gives the cursor somewhere to go.
import React from "react";

export const SeparatorHackView = () => <img className="wg-buffer" />;
