import { DraftError } from '../util.mjs';
import { inline } from '../md.mjs';

export default {
  name: 'tree',
  summary: 'Hierarchy: folders, modules, taxonomies, org charts.',
  syntax: `\`\`\`tree
src/ | source code              indent (2 spaces) for children; " | " adds a description
  api/ | HTTP handlers
    *auth.js | the part that changed     * highlights
  db/
\`\`\``,
  example: '```tree\nsrc/\n  api/ | HTTP handlers\n  *db.js | the part that matters\n```',
  render(text, ctx) {
    const rows = [];
    text.split('\n').forEach((raw, k) => {
      if (!raw.trim() || raw.trim().startsWith('//')) return;
      const depth = Math.floor(raw.replace(/\t/g, '  ').match(/^ */)[0].length / 2);
      let [label, ...desc] = raw.trim().split(' | ');
      const hot = label.startsWith('*');
      if (hot) label = label.slice(1).trim();
      rows.push({ depth, label, desc: desc.join(' | '), hot, line: k + 1 });
    });
    if (!rows.length) throw new DraftError('tree is empty', { line: 1 });
    const root = { children: [] };
    const stack = [root];
    for (const r of rows) {
      if (r.depth > stack.length - 1) throw new DraftError('Indent jumps more than one level', { line: r.line });
      stack.length = r.depth + 1;
      const node = { ...r, children: [] };
      stack[r.depth].children.push(node);
      stack.push(node);
    }
    const ul = (kids) => `<ul>${kids
      .map((n) => `<li><span class="tn${n.hot ? ' hot' : ''}">${inline(n.label, ctx)}</span>${n.desc ? ` <em>${inline(n.desc, ctx)}</em>` : ''}${n.children.length ? ul(n.children) : ''}</li>`)
      .join('')}</ul>`;
    const html = ul(root.children);
    return `<div class="tree">${html}</div>`;
  },
};
