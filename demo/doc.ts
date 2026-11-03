const image = (width: number, height: number, color: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="4" fill="${color}"/></svg>`
  );

export const doc = `<h2>react-wordgard</h2>
<p>Wordgard, drawn by React. Select some text for the <strong>text menu</strong>, type
<code>@</code> to mention someone, like <span data-mention="ada"></span>, and hover
<a href="https://wordgard.net">a link</a> for its card.</p>
<p>Select the figure below and drag its handles to resize it.</p>
<figure><img src="https://plus.unsplash.com/premium_photo-1661954483883-edd65eac3577?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D"></figure>
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
