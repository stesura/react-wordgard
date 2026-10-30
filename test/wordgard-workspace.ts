// Wordgard's test page (its bin/testserver.ts) has this element, and
// test/wordgard/tempview.ts mounts its editors in it.
const workspace = document.createElement("div");
workspace.id = "workspace";
workspace.style.cssText =
  "opacity: 0; position: fixed; top: 0; left: 0; width: 20em;";
document.body.appendChild(workspace);

// Vitest runs each test file in an iframe, which doesn't get focus on its
// own; the composition tests need it.
window.focus();
