// Draft (extended Markdown) -> { meta, intro, panels }.
// Every `## ` heading opens a panel. Fenced blocks whose language names a component become components.

import { parseAttrs, slug, DraftError } from './util.mjs';

export const META_CHOICES = {
  kind: ['explain', 'review'],
  mode: ['auto', 'light', 'dark'],
  verdict: ['approve', 'changes', 'discuss', 'block'],
  style: ['off', 'warn', 'strict'],
};

export function parseDraft(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  const meta = {};

  if (lines[0]?.trim() === '---') {
    i = 1;
    for (; i < lines.length && lines[i].trim() !== '---'; i++) {
      const raw = lines[i];
      if (!raw.trim() || raw.trim().startsWith('#')) continue;
      const m = raw.match(/^([\w-]+)\s*:\s*(.*)$/);
      if (!m) throw new DraftError(`Front matter line is not "key: value": ${raw.trim()}`, { line: i + 1, component: 'front-matter', example: 'title: How TCP opens a connection' });
      let value = m[2].replace(/\s+#.*$/, '').trim();
      if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
      meta[m[1]] = value;
    }
    if (i >= lines.length) throw new DraftError('Front matter is not closed with ---', { line: 1, component: 'front-matter' });
    i++;
  }

  for (const [key, choices] of Object.entries(META_CHOICES)) {
    if (meta[key] !== undefined && !choices.includes(meta[key])) {
      throw new DraftError(`${key}: "${meta[key]}" is not valid. Use one of: ${choices.join(' | ')}`, { component: 'front-matter', example: `${key}: ${choices[0]}` });
    }
  }

  const intro = [];
  const panels = [];
  let target = intro;
  let mdBuf = [];
  let mdStart = i + 1;
  const flush = () => {
    const text = mdBuf.join('\n');
    if (text.trim()) target.push({ type: 'md', text, line: mdStart });
    mdBuf = [];
  };
  const usedIds = new Set();

  for (; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*(.*)$/);
    if (fence) {
      flush();
      const [, , marker, lang, rest] = fence;
      const start = i + 1;
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) body.push(lines[i++]);
      if (i >= lines.length) throw new DraftError(`Code fence opened here is never closed (${marker})`, { line: start, component: lang || 'fence' });
      target.push({ type: 'fence', lang: lang.toLowerCase(), args: rest.trim(), text: body.join('\n'), line: start });
      mdStart = i + 2;
      continue;
    }
    const head = line.match(/^##\s+(.+?)\s*(?:\{([^}]*)\})?\s*$/);
    if (head) {
      flush();
      const attrs = head[2] ? parseAttrs(head[2]) : {};
      let id = attrs.id || slug(head[1]);
      while (usedIds.has(id)) id += '-2';
      usedIds.add(id);
      const panel = { title: head[1].trim(), attrs, id, blocks: [], line: i + 1 };
      panels.push(panel);
      target = panel.blocks;
      mdStart = i + 2;
      continue;
    }
    if (!mdBuf.length) mdStart = i + 1;
    mdBuf.push(line);
  }
  flush();
  return { meta, intro, panels };
}
