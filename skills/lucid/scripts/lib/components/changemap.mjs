import { esc } from '../util.mjs';
import { parseFlow, renderGraph } from './flow.mjs';

// The shape of a change: which files moved, how much, and (optionally) how they connect.
export default {
  name: 'changemap',
  summary: 'Review mode. Map of the changed files with sizes; add arrows to show how they connect.',
  syntax: `\`\`\`changemap [LR]
// With no lines: files grouped by folder with +/− bars.
// With arrows: a graph of the changed files (basename or path).
routes.js -> session.js: calls
session.js -> store.js: writes
\`\`\``,
  example: '```changemap LR\napi.js -> auth.js: verifies token\n```',
  render(text, ctx) {
    const diff = ctx.diff();
    const body = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).join('\n');
    const short = (f) => {
      const base = f.path.split('/').pop();
      return diff.files.filter((x) => x.path.split('/').pop() === base).length > 1 ? f.path : base;
    };
    const dir = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.');
    if (!body) {
      const max = Math.max(1, ...diff.files.map((f) => f.add + f.del));
      const groups = new Map();
      diff.files.forEach((f) => groups.set(dir(f.path), [...(groups.get(dir(f.path)) ?? []), f]));
      return `<div class="changemap">${[...groups]
        .map(([d, fs]) => `<div class="cm-dir"><h4>${esc(d)}/</h4>${fs
          .map((f) => `<div class="cm-file${ctx.coverageOf?.(f) === false ? ' uncovered' : ''}"><span class="st-${f.status}">${f.status}</span><code>${esc(f.path.split('/').pop())}</code><span class="bar"><i class="a" style="width:${(f.add / max) * 100}%"></i><i class="d" style="width:${(f.del / max) * 100}%"></i></span><span class="stat"><b class="a">+${f.add}</b> <b class="d">−${f.del}</b></span></div>`)
          .join('')}</div>`)
        .join('')}</div>`;
    }
    // Map names in arrows to changed files; unknown names stay as plain context nodes.
    const graph = parseFlow(body);
    const byName = new Map(diff.files.map((f) => [short(f), f]));
    diff.files.forEach((f) => byName.set(f.path, f));
    const nodes = new Map();
    for (const n of graph.nodes.values()) {
      const f = byName.get(n.id) ?? diff.files.find((x) => x.path.endsWith(`/${n.id}`));
      nodes.set(n.id, { ...n, label: f ? `${n.label}  +${f.add} −${f.del}` : n.label, file: f });
    }
    // Folder names go into the label: group boxes spanning several ranks overlap each other.
    for (const n of nodes.values()) {
      if (!n.file) continue;
      const d = dir(n.file.path).split('/').pop();
      if (!n.label.includes('/') && d !== '.') n.label = `${d}/${n.label}`;
    }
    return renderGraph(
      { nodes, edges: graph.edges, groups: [], steps: graph.steps },
      { dir: ctx.args.includes('LR') ? 'LR' : 'TB', uid: ctx.uid, playable: false },
    );
  },
};
