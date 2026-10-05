import { esc, textWidth, DraftError } from '../util.mjs';
import { inline } from '../md.mjs';
import { parseFlow } from './flow.mjs';
import { layoutGraph } from '../layout.mjs';

// Small multiples: the same mini diagram once per case, laid out once so every card has the same coordinates.
// Only what differs changes: parts a case does not use fade, the part that matters takes the case's status colour.
const STATUS = { ok: 'ok', warn: 'warn', risk: 'risk', info: 'info', off: 'off' };

export function parseCases(text) {
  const cases = [];
  let cur = null;
  text.split('\n').forEach((raw, k) => {
    const t = raw.trim();
    if (!t || t.startsWith('//')) return;
    const m = t.match(/^#\s*(ok|warn|risk|info|off)\s*\|\s*([^|]+?)(?:\s*\|\s*(.+))?$/i);
    if (m) return void cases.push((cur = { status: m[1].toLowerCase(), title: m[2].trim(), note: (m[3] ?? '').trim(), lines: [], line: k + 1 }));
    if (!cur) throw new DraftError('Start each case with "# ok|warn|risk|info | Title | optional note"', { line: k + 1, example: '# risk | Key expired | 16× load on Postgres' });
    cur.lines.push(t);
  });
  if (cases.length < 2) throw new DraftError('cases needs at least two cases (small multiples compare cases)', { line: 1 });
  if (cases.length > 6) throw new DraftError('Use at most 6 cases; split the rest into a second figure', { line: 1 });
  return cases;
}

export default {
  name: 'cases',
  summary: 'Small multiples: the same mini diagram once per case (failure modes, options, scenarios); only the difference changes.',
  syntax: `\`\`\`cases
# ok | Cache hit | 1 ms
App -> *Cache: get
# risk | Key expired | 9 ms, DB load ×16
App -> Cache: get
Cache --> App: miss
App -> *DB: query
# off | Cache down
App -> ~Cache
App -> *DB: every read
\`\`\`
Each case: "# status | title | note", then flow lines. Status: ok · warn · risk · info · off.
All cases share one layout, so the eye sees only the difference. * marks the part that matters in this case
(it takes the status colour); ~ marks a part that is down; nodes a case never mentions are faded.`,
  example: '```cases\n# ok | Hit\nApp -> *Cache\n# risk | Miss\nApp -> Cache\nApp -> *DB\n```',
  render(text, ctx) {
    const cases = parseCases(text).map((c) => ({ ...c, graph: parseFlow(c.lines.join('\n')) }));
    // One layout for the union of all cases.
    const nodes = new Map();
    const edges = new Map();
    for (const c of cases) {
      for (const n of c.graph.nodes.values()) if (!nodes.has(n.id)) nodes.set(n.id, { ...n, hot: false, faded: false });
      for (const e of c.graph.edges) {
        const key = `${e.from}\u0000${e.to}`;
        if (!edges.has(key)) edges.set(key, { from: e.from, to: e.to, kind: '->', label: '', labelW: 0 });
        // Leave room for the longest label any case puts on this arrow.
        if (e.label) edges.get(key).labelW = Math.max(edges.get(key).labelW, textWidth(e.label, 12) + 12);
      }
    }
    const F = 14; // drawn at roughly 0.8× in a card, so this lands at about 12px
    const size = (n) => ({ w: Math.max(48, textWidth(n.label, F) + 22), h: 32 });
    const L = layoutGraph({
      dir: 'LR',
      nodes: [...nodes.values()].map((n) => ({ id: n.id, ...size(n), group: null })),
      edges: [...edges.values()].map((e) => ({ ...e, labelSize: { w: Math.max(72, e.labelW), h: 16 } })),
      rankGap: 50,
      nodeGap: 16,
    });
    const pad = 10;
    const W = L.width + pad * 2;
    const H = L.height + pad * 2 + 6;
    const key = (e) => `${e.from}\u0000${e.to}`;
    const routes = new Map(L.edges.map((e) => [key(e), e]));
    const id = ctx.uid();
    const cards = cases.map((c) => {
      const used = c.graph.nodes;
      const st = STATUS[c.status];
      const parts = [];
      for (const e of c.graph.edges) {
        const r = routes.get(key(e));
        if (!r || r.points.length < 2) continue;
        const d = `M${r.points.map((p) => `${(p.x + pad).toFixed(1)},${(p.y + pad).toFixed(1)}`).join(' L')}`;
        const hot = used.get(e.to)?.hot || used.get(e.from)?.hot;
        parts.push(`<path class="ce${e.kind === '-->' ? ' dashed' : ''}${hot ? ' is-st' : ''}" d="${d}" marker-end="url(#${id}a)"/>`);
        if (e.label) {
          const a = r.points[0];
          const b = r.points[1];
          parts.push(`<text class="cl" x="${((a.x + b.x) / 2 + pad).toFixed(1)}" y="${((a.y + b.y) / 2 + pad - 5).toFixed(1)}">${esc(e.label)}</text>`);
        }
      }
      for (const n of nodes.values()) {
        const p = L.nodes.get(n.id);
        const mine = used.get(n.id);
        const cls = ['cn', !mine ? 'faded' : '', mine?.faded ? 'is-off' : '', mine?.hot ? 'is-st' : ''].filter(Boolean).join(' ');
        parts.push(`<g class="${cls}"><rect x="${(p.x - p.w / 2 + pad).toFixed(1)}" y="${(p.y - p.h / 2 + pad).toFixed(1)}" width="${p.w}" height="${p.h}" rx="5"/><text x="${(p.x + pad).toFixed(1)}" y="${(p.y + pad + 4).toFixed(1)}">${esc(n.label)}</text></g>`);
      }
      return `<div class="case st-${st}"><div class="case-head"><span class="case-chip">${esc(c.status === 'off' ? 'down' : c.status)}</span><strong>${inline(c.title, ctx)}</strong></div><svg viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(H)}" role="img" aria-label="${esc(`${c.title}${c.note ? `: ${c.note}` : ''}`)}"><defs><marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="context-stroke"/></marker></defs>${parts.join('')}</svg>${c.note ? `<p class="case-note">${inline(c.note, ctx)}</p>` : ''}</div>`;
    });
    return `<div class="cases">${cards.join('')}</div>`;
  },
};
