// A small, predictable Markdown renderer: paragraphs, headings, nested lists, tables,
// blockquotes, rules; inline code, bold, italic, strike, links and [[path:line]] code refs.

import { esc } from './util.mjs';

const STATUS = {
  ok: ['ok', '✓'], yes: ['ok', '✓'],
  no: ['no', '✗'],
  warn: ['warn', '!'], maybe: ['warn', '~'],
};

export function inline(text, ctx = {}) {
  const slots = [];
  const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = String(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, r) => keep(ctx.ref ? ctx.ref(r.trim()) : `<code>${esc(r)}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const safe = /^(https?:|mailto:|#|\.{0,2}\/|[\w-]+\.html)/i.test(href) ? href : '#';
    return keep(`<a href="${esc(safe)}">${inline(label, ctx)}</a>`);
  });
  s = esc(s);
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => slots[n]);
}

function statusCell(cell, ctx) {
  const m = cell.match(/^(ok|yes|no|warn|maybe)(?:\s+(.*))?$/); // lowercase only: "No such name" stays text
  if (!m) return inline(cell, ctx);
  const [cls, glyph] = STATUS[m[1]];
  return `<span class="st st-${cls}"><b aria-hidden="true">${glyph}</b>${m[2] ? ` ${inline(m[2], ctx)}` : `<span class="sr">${cls}</span>`}</span>`;
}

const splitRow = (row) => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

export function md(text, ctx = {}) {
  const lines = String(text).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }

    let m;
    if ((m = t.match(/^(#{3,6})\s+(.*)$/))) {
      const level = Math.min(m[1].length + 0, 6);
      out.push(`<h${level}>${inline(m[2], ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (/^([-*_])\1{2,}$/.test(t)) { out.push('<hr>'); i++; continue; }
    if (t.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) buf.push(lines[i++].trim().replace(/^>\s?/, ''));
      out.push(`<blockquote>${md(buf.join('\n'), ctx)}</blockquote>`);
      continue;
    }
    if (t.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      const head = splitRow(t);
      const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
      const al = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : '');
      out.push(`<div class="tbl"><table><thead><tr>${head.map((h, k) => `<th${al(k)}>${inline(h, ctx)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${head.map((_, k) => `<td${al(k)}>${statusCell(r[k] ?? '', ctx)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`);
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(t)) {
      const block = [];
      const listy = (l) => /^\s*([-*+]|\d+[.)])\s+|^\s{2,}\S/.test(l ?? '');
      while (i < lines.length) {
        if (listy(lines[i])) block.push(lines[i++]);
        else if (!lines[i].trim() && listy(lines[i + 1])) i++;
        else break;
      }
      out.push(list(block, ctx));
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{3,6}\s|>|\||([-*+]|\d+[.)])\s)/.test(lines[i].trim())) buf.push(lines[i++].trim());
    if (!buf.length) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(' '), ctx)}</p>`);
  }
  return out.join('\n');
}

function list(block, ctx) {
  const indentOf = (l) => l.match(/^\s*/)[0].length;
  const base = indentOf(block[0]);
  const ordered = /^\s*\d+[.)]/.test(block[0]);
  const items = [];
  for (const l of block) {
    if (!l.trim()) continue;
    const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (m && indentOf(l) <= base) items.push({ text: m[3], children: [] });
    else if (items.length) items[items.length - 1].children.push(l);
  }
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items
    .map((it) => {
      const kids = it.children.filter((c) => c.trim());
      const nested = kids.length && /^\s*([-*+]|\d+[.)])\s/.test(kids[0]) ? list(kids, ctx) : kids.length ? ` ${inline(kids.map((k) => k.trim()).join(' '), ctx)}` : '';
      return `<li>${inline(it.text, ctx)}${nested}</li>`;
    })
    .join('')}</${tag}>`;
}
