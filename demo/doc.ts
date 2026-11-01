const image = (width: number, height: number, color: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="4" fill="${color}"/></svg>`
  );

const flower =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#9ad4ff"/><stop offset="1" stop-color="#e8f6ff"/></linearGradient></defs><rect width="480" height="270" fill="url(#g)"/><rect y="200" width="480" height="70" fill="#7cc576"/><rect x="236" y="120" width="8" height="90" fill="#3f8f3a"/><g fill="#ff7aa8">${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="240" cy="92" rx="14" ry="30" transform="rotate(${a} 240 120)"/>`).join("")}</g><circle cx="240" cy="120" r="14" fill="#ffd34d"/></svg>`
  );

export const doc = `<h2>react-wordgard</h2>
<p>Wordgard, drawn by React. Select some text for the <strong>text menu</strong>, type
<code>@</code> to mention someone, like <span data-mention="ada"></span>, and hover
<a href="https://wordgard.net">a link</a> for its card.</p>
<p>Select the figure below and drag its handles to resize it.</p>
<figure><img src="${flower}"></figure>
<aside class="callout" data-kind="tip" data-title="Callouts"><p>A callout is a React
shape: its title bar is chrome, its content is <em>editable</em>. Click the icon to change
its kind, double-click the title to rename it.</p></aside>
<aside class="callout" data-kind="warning"><p>An untitled callout shows its kind. The arrow keys stop between a callout and
the figure or another callout.</p>
<ul><li><p>It holds any blocks,</p></li><li><p>lists too.</p></li></ul></aside>
<p>Plain Wordgard parts still work: <span style="color: crimson">colored
<span style="background-color: khaki">and highlighted</span></span> text, an inline image
widget <img src="${image(40, 24, "#6af")}"> that outlines on hover, a line<br>break.</p>
<blockquote><p>A quote.</p></blockquote>
<ol><li><p>A numbered item</p></li></ol>
<pre>some code</pre>
<hr>
<table><tbody><tr><th>Head</th><th>Other</th></tr><tr><td>A <em>cell</em></td><td>Another</td></tr></tbody></table>`;
