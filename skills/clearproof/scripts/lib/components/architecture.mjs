import { esc, textWidth, DraftError } from '../util.mjs';
import { player } from './player.mjs';

// System architecture: tiers stacked top to bottom (people → clients → edge → services → data → external),
// typed component cards with an icon, labelled connections, step-through playback.

const ICONS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  client: 'M3 4.5h18v11.5H3z M8 20h8 M12 16v4',
  mobile: 'M7 2.5h10v19H7z M11 18h2',
  gateway: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  lb: 'M12 3v6 M5 15v-3h14v3 M5 15v5 M12 9v11 M19 15v5',
  cdn: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  service: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
  worker: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1',
  function: 'M7 20l5.5-9 M8 4h2.5L18 20',
  ai: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  cache: 'M13 2L4.5 14H11l-1 8 8.5-12H12z',
  queue: 'M2.5 8h5v8h-5z M9.5 8h5v8h-5z M16.5 8h5v8h-5z',
  storage: 'M3 6h7l2 2h9v11H3z',
  file: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  external: 'M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z',
};
const ALIAS = {
  person: 'user', actor: 'user', customer: 'user', browser: 'client', web: 'client', app: 'client', ui: 'client', frontend: 'client',
  phone: 'mobile', api: 'service', server: 'service', backend: 'service', module: 'service', job: 'worker', cron: 'worker',
  lambda: 'function', serverless: 'function', llm: 'ai', model: 'ai', agent: 'ai', database: 'db', sql: 'db', table: 'db',
  redis: 'cache', stream: 'queue', topic: 'queue', bus: 'queue', bucket: 'storage', blob: 'storage', s3: 'storage',
  files: 'file', doc: 'file', config: 'file', proxy: 'gateway', auth: 'gateway', balancer: 'lb', 'third-party': 'external', saas: 'external',
};
const FAMILY = {
  user: 'people', client: 'people', mobile: 'people',
  gateway: 'edge', lb: 'edge', cdn: 'edge',
  service: 'compute', worker: 'compute', function: 'compute', ai: 'compute',
  db: 'data', cache: 'data', queue: 'data', storage: 'data', file: 'data',
  external: 'external',
};

const ARROW = /\s*(<->|-->|==>|->)\s*/;
const TITLE = 14;
const SUB = 12;
const GAP_X = 36;
const ROW_GAP = 78;
const BAND_T = 34;
const BAND_B = 18;
const SIDE = 28;
const MAX_ROW = 1040;

function parseNode(raw, line) {
  let t = raw.trim();
  let hot = false;
  let faded = false;
  for (;;) {
    if (t.startsWith('*')) [hot, t] = [true, t.slice(1).trim()];
    else if (t.startsWith('~')) [faded, t] = [true, t.slice(1).trim()];
    else break;
  }
  // "Name (kind) subtitle"; without "(kind)" the whole text is the name and the kind is service.
  const m = t.match(/^(.+?)\s*\(([\w-]+)\)\s*(.*)$/) || [t, t, '', ''];
  if (!m[1].trim()) throw new DraftError('Empty component name', { line, component: 'architecture' });
  const want = (m[2] || 'service').toLowerCase();
  const kind = ICONS[want] ? want : ALIAS[want];
  if (!kind) throw new DraftError(`Unknown kind "${m[2]}". Use one of: ${Object.keys(ICONS).join(', ')}`, { line, component: 'architecture' });
  return { id: m[1].trim(), kind, sub: m[3].trim(), hot, faded };
}

export function parseArchitecture(text) {
  const tiers = [];
  const nodes = new Map();
  const edges = [];
  let step = 0;
  const ref = (name, line) => {
    const id = name.replace(/^[*~]+/, '').trim();
    const n = nodes.get(id);
    if (!n) throw new DraftError(`"${id}" is not in any tier. Declare it under a tier first, e.g. "  ${id} (service)"`, { line, component: 'architecture' });
    if (name.trim().startsWith('*')) n.hot = true;
    return n;
  };
  text.split('\n').forEach((raw, k) => {
    const line = k + 1;
    const s = raw.trim();
    if (!s || s.startsWith('//')) return;
    const tier = s.match(/^tier\s+(.+?)\s*:?\s*$/i);
    if (tier) {
      tiers.push({ name: tier[1], nodes: [] });
      return;
    }
    if (!ARROW.test(s)) {
      if (!tiers.length) throw new DraftError('Start with a tier line, e.g. "tier Services"', { line, component: 'architecture' });
      for (const part of s.split(/\s*,\s*(?![^()]*\))/)) {
        const n = parseNode(part, line);
        if (nodes.has(n.id)) throw new DraftError(`"${n.id}" is declared twice`, { line, component: 'architecture' });
        n.tier = tiers.length - 1;
        n.step = Infinity;
        nodes.set(n.id, n);
        tiers.at(-1).nodes.push(n);
      }
      return;
    }
    // A -> B: label | caption      (also -->, ==>, <->, fan-out with &)
    let [body, note] = s.split(/\s+\|\s+/);
    let label = '';
    const tokens = body.split(ARROW);
    const last = tokens.length - 1;
    const colon = tokens[last].indexOf(': ');
    if (colon > 0) [tokens[last], label] = [tokens[last].slice(0, colon), tokens[last].slice(colon + 2).trim()];
    if (tokens.length < 3 || tokens.some((t, j) => j % 2 === 0 && !t.trim())) {
      throw new DraftError('Arrow is missing a component on one side', { line, component: 'architecture' });
    }
    step++;
    for (let j = 0; j + 2 < tokens.length; j += 2) {
      const froms = tokens[j].split(/\s*&\s*/).map((x) => ref(x, line));
      const tos = tokens[j + 2].split(/\s*&\s*/).map((x) => ref(x, line));
      let first = true;
      for (const a of froms) for (const b of tos) {
        a.step = Math.min(a.step, step);
        b.step = Math.min(b.step, step);
        // A fan-out shares one label: show it on the first line only.
        edges.push({ from: a.id, to: b.id, kind: tokens[j + 1], label: j + 2 === last && first ? label : '', note: note || '', step });
        first = false;
      }
    }
  });
  if (!tiers.length) throw new DraftError('An architecture needs at least one tier', { component: 'architecture' });
  for (const n of nodes.values()) if (n.step === Infinity) n.step = 0;
  return { tiers, nodes, edges, steps: step };
}

const cardSize = (n) => ({
  w: Math.max(150, 30 + 34 + Math.max(textWidth(n.id, TITLE) * 1.06, n.sub ? textWidth(n.sub, SUB) : 0) + 16),
  h: 58,
});

function bez(p, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
}

export function layoutArchitecture({ tiers, nodes, edges }) {
  for (const n of nodes.values()) Object.assign(n, cardSize(n));
  const order = tiers.map((t) => [...t.nodes]);
  const neighbours = (id) => edges.flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : []));
  // Rows: a tier wider than MAX_ROW wraps onto several rows.
  const place = () => {
    const rows = [];
    order.forEach((list, ti) => {
      let cur = [];
      let w = 0;
      for (const n of list) {
        if (cur.length && w + GAP_X + n.w > MAX_ROW) {
          rows.push({ tier: ti, nodes: cur });
          [cur, w] = [[], 0];
        }
        w += (cur.length ? GAP_X : 0) + n.w;
        cur.push(n);
      }
      if (cur.length || !list.length) rows.push({ tier: ti, nodes: cur });
    });
    const rowW = (r) => r.nodes.reduce((s, n) => s + n.w, 0) + GAP_X * Math.max(0, r.nodes.length - 1);
    const W = Math.max(640, ...rows.map(rowW)) + 2 * SIDE;
    let y = 0;
    const bands = [];
    const rowBox = [];
    let ri = 0;
    tiers.forEach((t, ti) => {
      const mine = rows.filter((r) => r.tier === ti);
      const top = y;
      y += BAND_T;
      for (const r of mine) {
        let x = (W - rowW(r)) / 2;
        for (const n of r.nodes) {
          Object.assign(n, { x: x + n.w / 2, y: y + n.h / 2, row: ri });
          x += n.w + GAP_X;
        }
        rowBox.push({ top: y, bottom: y + 58, nodes: r.nodes });
        y += 58 + 26;
        ri++;
      }
      y += BAND_B - 26;
      bands.push({ name: t.name, y0: top, y1: y });
      y += ROW_GAP - BAND_B - 6;
    });
    return { W, H: y - ROW_GAP + BAND_B + 6, bands, rows: rowBox };
  };
  // Two barycentre sweeps: put each card under the cards it talks to, so fewer lines cross.
  place();
  for (let sweep = 0; sweep < 2; sweep++) {
    const tierIdx = sweep === 0 ? order.map((_, i) => i) : order.map((_, i) => order.length - 1 - i);
    for (const ti of tierIdx) {
      const list = order[ti];
      const key = new Map(
        list.map((n, i) => {
          const xs = neighbours(n.id).map((id) => nodes.get(id)).filter((m) => m.tier !== ti).map((m) => m.x);
          return [n.id, xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : n.x + i * 1e-3];
        }),
      );
      list.sort((a, b) => key.get(a.id) - key.get(b.id));
      place();
    }
  }
  const box = place();

  // Ports: spread the lines that leave or enter the same side of a card.
  const ports = new Map();
  const side = (e, end) => {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (a.row === b.row) return end === 'from' ? (b.x > a.x ? 'r' : 'l') : b.x > a.x ? 'l' : 'r';
    const down = b.row > a.row;
    return end === 'from' ? (down ? 'b' : 't') : down ? 't' : 'b';
  };
  edges.forEach((e, i) => {
    for (const end of ['from', 'to']) {
      const id = e[end];
      const k = `${id}:${side(e, end)}`;
      const other = nodes.get(end === 'from' ? e.to : e.from);
      if (!ports.has(k)) ports.set(k, []);
      ports.get(k).push({ i, end, ox: other.x });
    }
  });
  const portX = new Map();
  for (const [k, list] of ports) {
    const n = nodes.get(k.slice(0, k.lastIndexOf(':')));
    list.sort((a, b) => a.ox - b.ox);
    const span = Math.min(n.w - 40, 22 * (list.length - 1));
    list.forEach((p, j) => portX.set(`${p.i}:${p.end}`, n.x + (list.length > 1 ? -span / 2 + (span * j) / (list.length - 1) : 0)));
  }

  const f1 = (v) => v.toFixed(1);
  const curve = (p) => `M${f1(p[0].x)},${f1(p[0].y)} C${f1(p[1].x)},${f1(p[1].y)} ${f1(p[2].x)},${f1(p[2].y)} ${f1(p[3].x)},${f1(p[3].y)}`;
  // Orthogonal path with rounded corners.
  const elbow = (pts) => {
    const q = pts.filter((p, k) => !k || Math.hypot(p.x - pts[k - 1].x, p.y - pts[k - 1].y) > 0.5);
    let d = `M${f1(q[0].x)},${f1(q[0].y)}`;
    for (let k = 1; k < q.length - 1; k++) {
      const [p0, p1, p2] = [q[k - 1], q[k], q[k + 1]];
      const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const r = Math.min(12, l1 / 2, l2 / 2);
      const a = { x: p1.x - ((p1.x - p0.x) / l1) * r, y: p1.y - ((p1.y - p0.y) / l1) * r };
      const c = { x: p1.x + ((p2.x - p1.x) / l2) * r, y: p1.y + ((p2.y - p1.y) / l2) * r };
      d += ` L${f1(a.x)},${f1(a.y)} Q${f1(p1.x)},${f1(p1.y)} ${f1(c.x)},${f1(c.y)}`;
    }
    const z = q.at(-1);
    return d + ` L${f1(z.x)},${f1(z.y)}`;
  };
  const gap = (r) => (box.rows[r].bottom + box.rows[r + 1].top) / 2;
  // Free vertical channels through a row: the spaces beside and between its cards.
  const free = (r) => {
    const cards = [...box.rows[r].nodes].sort((p, q) => p.x - q.x);
    const out = [];
    let x = 14;
    for (const n of cards) {
      out.push([x, n.x - n.w / 2 - 10]);
      x = n.x + n.w / 2 + 10;
    }
    out.push([x, box.W - 14]);
    return out.filter(([p, q]) => q - p > 4);
  };
  const meet = (A, B) => A.flatMap(([a0, a1]) => B.map(([b0, b1]) => [Math.max(a0, b0), Math.min(a1, b1)])).filter(([p, q]) => q - p > 4);
  const used = new Map();

  const routes = edges.map((e, i) => {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (a.row === b.row) {
      const between = [...nodes.values()].some((n) => n.row === a.row && n !== a && n !== b && (n.x - a.x) * (n.x - b.x) < 0);
      if (!between) {
        const dir = b.x > a.x ? 1 : -1;
        const s = { x: a.x + (dir * a.w) / 2, y: a.y };
        const f = { x: b.x - (dir * b.w) / 2, y: b.y };
        return { ...e, d: `M${f1(s.x)},${f1(s.y)} L${f1(f.x)},${f1(f.y)}`, labelAt: { x: (s.x + f.x) / 2, y: s.y - 24 } };
      }
      const s = { x: a.x, y: a.y - a.h / 2 };
      const f = { x: b.x, y: b.y - b.h / 2 };
      const pts = [s, { x: s.x, y: s.y - 30 }, { x: f.x, y: f.y - 30 }, f];
      return { ...e, d: curve(pts), labelAt: bez(pts, 0.5) };
    }
    const down = b.row > a.row;
    const s = { x: portX.get(`${i}:from`), y: a.y + ((down ? 1 : -1) * a.h) / 2 };
    const f = { x: portX.get(`${i}:to`), y: b.y - ((down ? 1 : -1) * b.h) / 2 };
    if (Math.abs(b.row - a.row) === 1) {
      const dy = f.y - s.y;
      const pts = [s, { x: s.x, y: s.y + dy * 0.5 }, { x: f.x, y: f.y - dy * 0.5 }, f];
      return { ...e, d: curve(pts), labelAt: bez(pts, 0.5) };
    }
    // Skips a tier: leave into the first gap, run down a free channel between cards, enter from the last gap.
    const lo = Math.min(a.row, b.row);
    const hi = Math.max(a.row, b.row);
    let span = [[14, box.W - 14]];
    for (let r = lo + 1; r < hi; r++) span = meet(span, free(r));
    const want = (s.x + f.x) / 2;
    let cx = want;
    let cost = Infinity;
    for (const [p, q] of span) {
      const x = Math.min(Math.max(want, p + 6), q - 6);
      if (Math.abs(x - want) < cost) [cx, cost] = [x, Math.abs(x - want)];
    }
    const k = Math.round(cx / 10);
    const n = used.get(k) || 0;
    used.set(k, n + 1);
    cx += n * 9 * (n % 2 ? 1 : -1);
    const y1 = down ? gap(a.row) : gap(a.row - 1);
    const y2 = down ? gap(b.row - 1) : gap(b.row);
    const pts = [s, { x: s.x, y: y1 }, { x: cx, y: y1 }, { x: cx, y: y2 }, { x: f.x, y: y2 }, f];
    return { ...e, d: elbow(pts), labelAt: { x: Math.abs(cx - s.x) > 40 ? (s.x + cx) / 2 : s.x, y: y1 } };
  });

  // Labels: pills that must not overlap each other or a card.
  const placed = [...nodes.values()].map((n) => ({ x0: n.x - n.w / 2 - 4, x1: n.x + n.w / 2 + 4, y0: n.y - n.h / 2 - 4, y1: n.y + n.h / 2 + 4 }));
  const hit = (r) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
  for (const r of routes) {
    if (!r.label) continue;
    const w = textWidth(r.label, 12) + 16;
    const h = 20;
    let best = null;
    for (const [dx, dy] of [[0, 0], [0, -14], [0, 14], [w / 2 + 6, 0], [-w / 2 - 6, 0], [0, -26], [0, 26], [w + 8, 0], [-w - 8, 0], [w / 2 + 6, -14], [-w / 2 - 6, -14], [w / 2 + 6, 14], [-w / 2 - 6, 14]]) {
      const x = Math.min(Math.max(r.labelAt.x + dx, w / 2 + 4), box.W - w / 2 - 4);
      const y = r.labelAt.y + dy;
      const rect = { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 };
      if (!hit(rect)) {
        best = { x, y, w, h };
        break;
      }
    }
    best ??= { x: r.labelAt.x, y: r.labelAt.y, w, h };
    placed.push({ x0: best.x - w / 2, x1: best.x + w / 2, y0: best.y - h / 2, y1: best.y + h / 2 });
    r.pill = best;
  }
  return { ...box, routes };
}

export function renderArchitecture(graph, { uid, playable = true }) {
  const L = layoutArchitecture(graph);
  const id = uid();
  const f = (v) => v.toFixed(1);
  const parts = [];
  parts.push(`<defs><marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="arrowhead"/></marker></defs>`);
  for (const b of L.bands) {
    parts.push(`<g class="tier"><rect x="8" y="${f(b.y0)}" width="${f(L.W - 16)}" height="${f(b.y1 - b.y0)}" rx="14"/><text x="24" y="${f(b.y0 + 21)}">${esc(b.name)}</text></g>`);
  }
  const labels = [];
  for (const r of L.routes) {
    const cls = ['edge', r.kind === '-->' ? 'dashed' : '', r.kind === '==>' ? 'thick' : ''].filter(Boolean).join(' ');
    const d = r.d;
    const marks = `${r.kind === '<->' ? ` marker-start="url(#${id}a)"` : ''} marker-end="url(#${id}a)"`;
    const note = r.note || (r.label ? `${r.from} → ${r.to}: ${r.label}` : `${r.from} → ${r.to}`);
    parts.push(`<g class="${cls}" data-step="${r.step}" data-from="${esc(r.from)}" data-to="${esc(r.to)}" data-note="${esc(note)}"><path d="${d}"${marks}/></g>`);
    if (r.pill) {
      const p = r.pill;
      labels.push(`<g class="${cls} apill" data-step="${r.step}"><rect x="${f(p.x - p.w / 2)}" y="${f(p.y - p.h / 2)}" width="${f(p.w)}" height="${p.h}" rx="10"/><text class="elabel" x="${f(p.x)}" y="${f(p.y + 4)}">${esc(r.label)}</text></g>`);
    }
  }
  for (const n of graph.nodes.values()) {
    const x0 = n.x - n.w / 2;
    const y0 = n.y - n.h / 2;
    const tx = x0 + 52;
    const fam = FAMILY[n.kind];
    parts.push(
      `<g class="node arch fam-${fam}${n.hot ? ' hot' : ''}${n.faded ? ' faded' : ''}" data-step="${n.step}" data-id="${esc(n.id)}">` +
        `<rect class="card" x="${f(x0)}" y="${f(y0)}" width="${f(n.w)}" height="${n.h}" rx="12"/>` +
        `<rect class="tile" x="${f(x0 + 12)}" y="${f(n.y - 15)}" width="30" height="30" rx="8"/>` +
        `<path class="ico" transform="translate(${f(x0 + 15)},${f(n.y - 12)})" d="${ICONS[n.kind]}"/>` +
        `<text class="t" x="${f(tx)}" y="${f(n.sub ? n.y - 3 : n.y + 5)}">${esc(n.id)}</text>` +
        (n.sub ? `<text class="s" x="${f(tx)}" y="${f(n.y + 14)}">${esc(n.sub)}</text>` : '') +
        `</g>`,
    );
  }
  parts.push(...labels);
  const svg = `<svg class="graph archsvg" viewBox="0 0 ${Math.ceil(L.W)} ${Math.ceil(L.H)}" style="max-width:${Math.ceil(L.W)}px" role="img" aria-label="Architecture diagram">${parts.join('')}</svg>`;
  const steps = graph.steps;
  return `<figure class="diagram arch-fig${playable ? ' playable' : ''}" data-steps="${steps}">${svg}${playable && steps > 1 ? player(steps) : ''}</figure>`;
}

export default {
  name: 'architecture',
  summary: 'System architecture: tiers of typed components (users, apps, gateways, services, databases, queues, external) with icons and labelled connections. Step-through playback.',
  syntax: `\`\`\`architecture [static]
tier Users
  Shopper (user) mobile and web          Name (kind) subtitle: the tech, file or role
tier Apps
  Web app (client) Next.js, Mobile app (mobile) React Native     several per line, comma-separated
tier Edge
  API gateway (gateway) auth + rate limit
tier Services
  *Orders (service) src/orders/          * highlights the part that matters; ~ fades one
  Payments (service), Email worker (worker) BullMQ
tier Data
  Orders DB (db) Postgres 15, Cache (cache) Redis, Events (queue) Kafka
tier External
  Stripe (external)
Shopper -> Web app: browses
Web app -> API gateway: HTTPS | caption shown at this step
API gateway ==> Orders: POST /orders     ==> the main path
Orders --> Events: order.created         --> async / optional
Orders -> Orders DB & Cache              fan out
\`\`\`
Kinds: user, client, mobile, gateway, lb, cdn, service, worker, function, ai, db, cache, queue, storage, file, external
(aliases: browser, api, server, job, lambda, llm, model, database, redis, stream, bucket, saas…).
Order tiers from the people at the top to the data and third parties at the bottom. Cards in a tier are reordered
automatically to reduce crossings. Each arrow line is one playback step.`,
  example: '```architecture\ntier Users\n  Reader (user)\ntier App\n  Web app (client) React\ntier Services\n  *API (service) Node.js\ntier Data\n  Postgres (db)\nReader -> Web app: opens\nWeb app -> API: GET /posts\nAPI -> Postgres: SELECT\n```',
  render(text, ctx) {
    const graph = parseArchitecture(text);
    return renderArchitecture(graph, { uid: ctx.uid, playable: !ctx.args.split(/\s+/).includes('static') });
  },
};
