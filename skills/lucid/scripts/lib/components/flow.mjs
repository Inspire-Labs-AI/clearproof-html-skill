import { esc, textWidth, wrap, DraftError } from '../util.mjs';
import { layoutGraph } from '../layout.mjs';
import { player } from './player.mjs';

const ARROW = /\s*(<->|-->|==>|->)\s*/;
const FONT = 13;
const LINE = 17;

export function parseNode(raw) {
  let t = raw.trim();
  let hot = false;
  if (t.startsWith('*')) {
    hot = true;
    t = t.slice(1).trim();
  }
  let shape = 'box';
  let m;
  if ((m = t.match(/^\[\((.+)\)\]$/))) [shape, t] = ['db', m[1]];
  else if ((m = t.match(/^\{(.+)\}$/))) [shape, t] = ['decision', m[1]];
  else if ((m = t.match(/^\((.+)\)$/))) [shape, t] = ['round', m[1]];
  else if ((m = t.match(/^\[(.+)\]$/))) [shape, t] = ['box', m[1]];
  return { id: t.trim(), label: t.trim(), shape, hot };
}

// Index of the ": " that starts an edge label, ignoring colons inside (), [] and {} node names.
function labelColon(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    else if (c === ':' && !depth && /\s/.test(s[i + 1] ?? '')) return i;
  }
  return -1;
}

export function parseFlow(text) {
  const nodes = new Map();
  const edges = [];
  const groups = [];
  let step = 0;
  const touch = (raw, line) => {
    const n = parseNode(raw);
    if (!n.id) throw new DraftError('Empty node name', { line });
    const old = nodes.get(n.id);
    if (!old) nodes.set(n.id, { ...n, step: Infinity });
    else {
      if (n.shape !== 'box') old.shape = n.shape;
      old.hot ||= n.hot;
    }
    return nodes.get(n.id);
  };
  text.split('\n').forEach((raw, k) => {
    const line = k + 1;
    const t = raw.trim();
    if (!t || t.startsWith('//')) return;
    const g = t.match(/^group\s+(.+?)\s*:\s*(.+)$/i);
    if (g) {
      groups.push({ name: g[1], members: g[2].split(/\s*[,&]\s*/).map((s) => touch(s, line).id) });
      return;
    }
    let body = t;
    let note = '';
    const bar = body.lastIndexOf(' | ');
    if (bar > 0) {
      note = body.slice(bar + 3).trim();
      body = body.slice(0, bar);
    }
    // Label first ("A -> B: label", colons inside node brackets do not count), then the arrows.
    let label = '';
    const colon = labelColon(body);
    if (colon > 0) {
      label = body.slice(colon + 1).trim();
      body = body.slice(0, colon);
    }
    const parts = body.split(ARROW).map((x) => x.trim());
    if (parts.length === 1) {
      touch(body, line);
      return;
    }
    if (parts.some((x, j) => j % 2 === 0 && (!x || /(^|\s)&$|^&/.test(x)))) {
      throw new DraftError(`Arrow is missing a node on one side: "${t}"`, { line, example: 'A -> B: label' });
    }
    step++;
    for (let j = 0; j + 2 < parts.length; j += 2) {
      const froms = parts[j].split(/\s+&\s+/).map((s) => touch(s, line));
      const tos = parts[j + 2].split(/\s+&\s+/).map((s) => touch(s, line));
      if (froms.some((n) => !n.id) || tos.some((n) => !n.id)) throw new DraftError('Arrow is missing a node on one side', { line });
      const kind = parts[j + 1];
      for (const a of froms)
        for (const b of tos) {
          edges.push({ from: a.id, to: b.id, kind, label: j + 2 === parts.length - 1 ? label : '', note, step, line });
          a.step = Math.min(a.step, step);
          b.step = Math.min(b.step, step);
        }
    }
  });
  if (!nodes.size) throw new DraftError('flow has no nodes', { line: 1 });
  for (const n of nodes.values()) if (n.step === Infinity) n.step = 0;
  return { nodes, edges, groups, steps: step };
}

function measure(n) {
  const max = n.shape === 'decision' ? 130 : 170;
  const lines = wrap(n.label, max, FONT);
  const tw = Math.max(...lines.map((l) => textWidth(l, FONT)));
  let w = tw + 26;
  let h = lines.length * LINE + 16;
  if (n.shape === 'decision') [w, h] = [tw + 44, h + 8];
  if (n.shape === 'round') w += 10;
  if (n.shape === 'db') h += 12;
  return { lines, w: Math.max(w, 56), h };
}

function shapeSvg(n, p) {
  const x = p.x - p.w / 2;
  const y = p.y - p.h / 2;
  switch (n.shape) {
    case 'round':
      return `<rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" rx="${p.h / 2}"/>`;
    case 'decision': {
      const k = 16;
      return `<polygon points="${x + k},${y} ${x + p.w - k},${y} ${x + p.w},${p.y} ${x + p.w - k},${y + p.h} ${x + k},${y + p.h} ${x},${p.y}"/>`;
    }
    case 'db': {
      const e = 6;
      return `<path d="M${x},${y + e} a${p.w / 2},${e} 0 0,0 ${p.w},0 a${p.w / 2},${e} 0 0,0 ${-p.w},0 v${p.h - 2 * e} a${p.w / 2},${e} 0 0,0 ${p.w},0 v${-(p.h - 2 * e)}"/>`;
    }
    default:
      return `<rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" rx="6"/>`;
  }
}

function pathD(points, LR) {
  if (points.length === 1) {
    const p = points[0];
    return `M${p.x},${p.y - 6} c26,-26 26,18 0,12`;
  }
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let j = 1; j < points.length; j++) {
    const a = points[j - 1];
    const b = points[j];
    if (LR) {
      const m = (b.x - a.x) / 2;
      d += ` C${(a.x + m).toFixed(1)},${a.y.toFixed(1)} ${(b.x - m).toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    } else {
      const m = (b.y - a.y) / 2;
      d += ` C${a.x.toFixed(1)},${(a.y + m).toFixed(1)} ${b.x.toFixed(1)},${(b.y - m).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    }
  }
  return d;
}

export function renderGraph({ nodes, edges, groups, steps }, { dir = 'TB', uid, playable = false, decorate }) {
  const LR = dir === 'LR';
  const measured = new Map([...nodes.values()].map((n) => [n.id, measure(n)]));
  const groupOf = new Map();
  groups.forEach((g) => g.members.forEach((m) => groupOf.set(m, g.name)));
  const L = layoutGraph({
    dir,
    nodes: [...nodes.values()].map((n) => ({ id: n.id, w: measured.get(n.id).w, h: measured.get(n.id).h, group: groupOf.get(n.id) ?? null })),
    edges: edges.map((e) => ({ ...e, labelSize: e.label ? { w: Math.min(textWidth(e.label, 12), 180) + 8, h: wrap(e.label, 180, 12).length * 15 + 4 } : null })),
    rankGap: LR ? 64 : 52,
  });

  const pad = 16;
  let minX = 0;
  let minY = 0;
  let maxX = L.width;
  let maxY = L.height;
  const groupBoxes = groups.map((g) => {
    const ps = g.members.map((m) => L.nodes.get(m)).filter(Boolean);
    const box = {
      name: g.name,
      x0: Math.min(...ps.map((p) => p.x - p.w / 2)) - 12,
      y0: Math.min(...ps.map((p) => p.y - p.h / 2)) - 26,
      x1: Math.max(...ps.map((p) => p.x + p.w / 2)) + 12,
      y1: Math.max(...ps.map((p) => p.y + p.h / 2)) + 12,
    };
    box.x1 = Math.max(box.x1, box.x0 + textWidth(g.name, 11) + 20);
    minX = Math.min(minX, box.x0);
    minY = Math.min(minY, box.y0);
    maxX = Math.max(maxX, box.x1);
    maxY = Math.max(maxY, box.y1);
    return box;
  });
  for (const e of L.edges) {
    if (!e.labelSize) continue;
    minX = Math.min(minX, e.labelPos.x - e.labelSize.w / 2);
    maxX = Math.max(maxX, e.labelPos.x + e.labelSize.w / 2);
    minY = Math.min(minY, e.labelPos.y - e.labelSize.h / 2);
    maxY = Math.max(maxY, e.labelPos.y + e.labelSize.h / 2);
  }
  const vb = `${(minX - pad).toFixed(0)} ${(minY - pad).toFixed(0)} ${(maxX - minX + 2 * pad).toFixed(0)} ${(maxY - minY + 2 * pad).toFixed(0)}`;
  const id = uid();
  const W = maxX - minX + 2 * pad;

  const parts = [];
  const labels = [];
  parts.push(`<defs><marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="arrowhead"/></marker></defs>`);
  for (const g of groupBoxes) {
    parts.push(`<g class="grp"><rect x="${g.x0}" y="${g.y0}" width="${g.x1 - g.x0}" height="${g.y1 - g.y0}" rx="10"/><text x="${g.x0 + 10}" y="${g.y0 + 16}">${esc(g.name)}</text></g>`);
  }
  for (const e of L.edges) {
    const cls = ['edge', e.kind === '-->' ? 'dashed' : '', e.kind === '==>' ? 'thick' : ''].filter(Boolean).join(' ');
    const marks = `${e.kind === '<->' ? ` marker-start="url(#${id}a)"` : ''} marker-end="url(#${id}a)"`;
    const note = e.note || e.label || `${e.from} → ${e.to}`;
    parts.push(`<g class="${cls}" data-step="${e.step}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-note="${esc(note)}"><path d="${pathD(e.points, LR)}"${marks}/></g>`);
    if (e.label) labels.push(`<g class="${cls}" data-step="${e.step}">${
      e.label
        ? `<text class="elabel" x="${e.labelPos.x.toFixed(1)}" y="${(e.labelPos.y - ((wrap(e.label, 180, 12).length - 1) * 15) / 2 + 4).toFixed(1)}">${wrap(e.label, 180, 12)
            .map((l, j) => `<tspan x="${e.labelPos.x.toFixed(1)}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`)
            .join('')}</text>`
        : ''
    }</g>`);
  }
  parts.push(...labels); // above every line, so the label halo masks crossings
  for (const n of nodes.values()) {
    const p = L.nodes.get(n.id);
    const m = measured.get(n.id);
    const y0 = p.y - ((m.lines.length - 1) * LINE) / 2 + 4.5 + (n.shape === 'db' ? 4 : 0);
    const extra = decorate ? decorate(n, p) : '';
    parts.push(`<g class="node ${n.shape}${n.hot ? ' hot' : ''}" data-step="${n.step}" data-id="${esc(n.id)}">${shapeSvg(n, p)}<text x="${p.x}" y="${y0}">${m.lines
      .map((l, j) => `<tspan x="${p.x}" dy="${j ? LINE : 0}">${esc(l)}</tspan>`)
      .join('')}</text>${extra}</g>`);
  }
  const svg = `<svg class="graph" viewBox="${vb}" style="max-width:${Math.ceil(W)}px" role="img" aria-label="Diagram">${parts.join('')}</svg>`;
  return `<figure class="diagram${playable ? ' playable' : ''}" data-steps="${steps}">${svg}${playable && steps > 1 ? player(steps) : ''}</figure>`;
}

export default {
  name: 'flow',
  summary: 'Boxes and arrows: architecture, call chains, decisions, state machines. Auto layout; step-through playback.',
  syntax: `\`\`\`flow [LR] [static]
A -> B: label                 solid arrow, label on the arrow
A --> B                       dashed (async, optional, fallback)
A ==> B                       thick (the main path)
A <-> B                       both ways
A -> B & C                    fan out
A -> B -> C: label            chain; the label goes on the last hop
A -> B: label | step note     text after " | " is the caption shown at this step
(Start)  {Valid?}  [(Orders DB)]  [Box]  *Hot   node shapes; * highlights
group Backend: API, Worker    draw a box around nodes
// comment
\`\`\`
Each arrow line is one playback step. Add "static" to hide the player.
Groups work when their members sit side by side in the layout. If members of two groups link back and forth,
the boxes overlap (--check reports it); drop the groups and put the names in the labels instead.`,
  example: '```flow LR\n(Request) -> {Cached?}\n{Cached?} -> *Cache: yes\n{Cached?} -> [(DB)]: no | Miss: read from the database\n```',
  render(text, ctx) {
    const graph = parseFlow(text);
    const flags = ctx.args.split(/\s+/);
    const dir = flags.includes('LR') ? 'LR' : 'TB';
    return renderGraph(graph, { dir, uid: ctx.uid, playable: !flags.includes('static') });
  },
};
