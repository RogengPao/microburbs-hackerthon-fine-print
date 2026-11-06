// Tiny, dependency-free Markdown → HTML for agent replies (no build step, no CDN).
// SAFE BY CONSTRUCTION: the whole input is HTML-escaped first, then a fixed set of
// Markdown patterns become tags. Raw HTML from the model is never rendered, and
// links are only http(s) (opened in a new tab, no opener).
//
// Supports: # headings, paragraphs, line breaks, **bold**, *italic*, ~~strike~~,
// `code`, ```fenced code```, - / * / 1. lists (one level of nesting), > quotes,
// --- rules, [links](https://…), and | tables |.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline formatting on an already-escaped line. */
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`); // protect code spans
  s = s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function renderMarkdown(src) {
  const lines = esc(String(src ?? '').replace(/\r\n?/g, '\n')).split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // fenced code
    if (/^\s*```/.test(line)) {
      flush();
      const body = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      out.push(`<pre><code>${body.join('\n')}</code></pre>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // heading
    const h = line.match(/^\s*(#{1,4})\s+(.*?)\s*#*\s*$/);
    if (h) {
      flush();
      const n = Math.min(h[1].length + 2, 6); // # → h3: panel-sized
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      continue;
    }
    // rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      continue;
    }
    // table
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const head = cells(line);
      i++;
      const rows = [];
      while (i + 1 < lines.length && isTableRow(lines[i + 1])) rows.push(cells(lines[++i]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
      );
      continue;
    }
    // quote
    if (/^\s*&gt;\s?/.test(line)) {
      flush();
      const body = [];
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) body.push(inline(lines[i++].replace(/^\s*&gt;\s?/, '')));
      i--;
      out.push(`<blockquote>${body.join('<br>')}</blockquote>`);
      continue;
    }
    // list (top level + one nested level)
    const m = line.match(LIST);
    if (m) {
      flush();
      const ordered = /\d/.test(m[2]);
      const items = [];
      while (i < lines.length && LIST.test(lines[i])) {
        const [, indent, marker, text] = lines[i].match(LIST);
        if (indent.length >= 2 && items.length) {
          const last = items[items.length - 1];
          (last.children ??= { ordered: /\d/.test(marker), items: [] }).items.push(inline(text));
        } else {
          items.push({ html: inline(text) });
        }
        i++;
        // a continuation line (indented, not a new item) joins the previous item
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !LIST.test(lines[i])) items[items.length - 1].html += `<br>${inline(lines[i++].trim())}`;
      }
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push(
        `<${tag}>${items
          .map((it) => {
            const sub = it.children ? `<${it.children.ordered ? 'ol' : 'ul'}>${it.children.items.map((c) => `<li>${c}</li>`).join('')}</${it.children.ordered ? 'ol' : 'ul'}>` : '';
            return `<li>${it.html}${sub}</li>`;
          })
          .join('')}</${tag}>`,
      );
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join('');
}
