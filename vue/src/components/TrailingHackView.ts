// Adapted from react-wordgard's TrailingHackView for Vue: the `<br>` a textblock may need
// (`Widget.br`).
import { h } from "vue";

export const TrailingHackView = (key: string) => h("br", { key });
