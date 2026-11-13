// Moves the element it's attached to to the page's body, as Vue's <Teleport to="body">: the menus
// sit at page coordinates, outside the editor's positioned container.
import type { Attachment } from "svelte/attachments";

export const portal: Attachment = (element) => {
  document.body.appendChild(element);
  return () => element.remove();
};
