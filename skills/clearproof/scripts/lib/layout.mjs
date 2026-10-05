// Layered graph layout (Sugiyama style), no dependencies.
// 1 break cycles  2 rank (longest path)  3 split long edges with dummies
// 4 order layers by barycenter sweeps  5 place across the layer with isotonic regression
// 6 route edges through dummies, spread labels so they do not collide.

export function layoutGraph({ nodes, edges, dir = 'TB', nodeGap = 28, rankGap = 56 }) {
  const LR = dir === 'LR';
  const ids = nodes.map((n) => n.id);
  const N = new Map(nodes.map((n) => [n.id, { ...n }]));
  const along = (n) => (LR ? n.w : n.h); // size on the rank axis
  const across = (n) => (LR ? n.h : n.w); // size inside a layer

  // 1. Cycle removal: reverse edges that point back to a node on the DFS stack.
  const out = new Map(ids.map((id) => [id, []]));
  edges.forEach((e, k) => e.from !== e.to && out.get(e.from).push(k));
  const state = new Map();
  const reversed = new Set();
  const dfs = (v) => {
    state.set(v, 1);
    for (const k of out.get(v)) {
      const w = edges[k].to;
      if (state.get(w) === 1) reversed.add(k);
      else if (!state.get(w)) dfs(w);
    }
    state.set(v, 2);
  };
  ids.forEach((id) => !state.get(id) && dfs(id));
  const dag = edges
    .map((e, k) => ({ k, from: reversed.has(k) ? e.to : e.from, to: reversed.has(k) ? e.from : e.to }))
    .filter((e) => e.from !== e.to);

  // 2. Ranking: longest path from the sources, then pull sources down next to their first child.
  const rank = new Map(ids.map((id) => [id, 0]));
  const indeg = new Map(ids.map((id) => [id, 0]));
  dag.forEach((e) => indeg.set(e.to, indeg.get(e.to) + 1));
  const queue = ids.filter((id) => !indeg.get(id));
  const topo = [];
  while (queue.length) {
    const v = queue.shift();
    topo.push(v);
    for (const e of dag.filter((d) => d.from === v)) {
      rank.set(e.to, Math.max(rank.get(e.to), rank.get(v) + 1));
      indeg.set(e.to, indeg.get(e.to) - 1);
      if (!indeg.get(e.to)) queue.push(e.to);
    }
  }
  for (const v of ids) {
    const hasIn = dag.some((e) => e.to === v);
    const kids = dag.filter((e) => e.from === v).map((e) => rank.get(e.to));
    if (!hasIn && kids.length) rank.set(v, Math.max(0, Math.min(...kids) - 1));
  }

  // 3. Dummy nodes for edges that span more than one rank.
  const maxRank = Math.max(0, ...rank.values());
  const layers = Array.from({ length: maxRank + 1 }, () => []);
  ids.forEach((id) => layers[rank.get(id)].push(id));
  const chains = new Map(); // edge index -> [from, d1, d2, ..., to] in DAG direction
  let dn = 0;
  for (const e of dag) {
    const chain = [e.from];
    for (let r = rank.get(e.from) + 1; r < rank.get(e.to); r++) {
      const id = `\u0000d${dn++}`;
      N.set(id, { id, w: LR ? 2 : 10, h: LR ? 10 : 2, dummy: true, group: null });
      rank.set(id, r);
      layers[r].push(id);
      chain.push(id);
    }
    chain.push(e.to);
    chains.set(e.k, chain);
  }
  const up = new Map([...N.keys()].map((id) => [id, []]));
  const down = new Map([...N.keys()].map((id) => [id, []]));
  for (const chain of chains.values()) {
    for (let j = 0; j + 1 < chain.length; j++) {
      down.get(chain[j]).push(chain[j + 1]);
      up.get(chain[j + 1]).push(chain[j]);
    }
  }

  // 4. Ordering: barycenter sweeps, keep the order with the fewest crossings.
  const pos = new Map();
  const index = () => layers.forEach((L) => L.forEach((id, j) => pos.set(id, j)));
  index();
  const crossings = () => {
    let c = 0;
    for (let r = 0; r + 1 < layers.length; r++) {
      const segs = [];
      layers[r].forEach((v) => down.get(v).forEach((w) => segs.push([pos.get(v), pos.get(w)])));
      for (let a = 0; a < segs.length; a++)
        for (let b = a + 1; b < segs.length; b++)
          if ((segs[a][0] - segs[b][0]) * (segs[a][1] - segs[b][1]) < 0) c++;
    }
    return c;
  };
  const sortLayer = (L, nb) => {
    const key = new Map();
    L.forEach((v) => {
      const ns = nb.get(v);
      key.set(v, ns.length ? ns.reduce((s, w) => s + pos.get(w), 0) / ns.length : pos.get(v));
    });
    // Keep members of a group together: they share the group's mean key.
    const groups = new Map();
    L.forEach((v) => {
      const g = N.get(v).group;
      if (g) groups.set(g, [...(groups.get(g) ?? []), key.get(v)]);
    });
    const gk = (v) => {
      const g = N.get(v).group;
      return g ? groups.get(g).reduce((a, b) => a + b, 0) / groups.get(g).length : key.get(v);
    };
    L.sort((a, b) => gk(a) - gk(b) || key.get(a) - key.get(b) || pos.get(a) - pos.get(b));
    L.forEach((id, j) => pos.set(id, j));
  };
  let best = layers.map((L) => [...L]);
  let bestC = crossings();
  for (let it = 0; it < 12 && bestC > 0; it++) {
    if (it % 2 === 0) for (let r = 1; r < layers.length; r++) sortLayer(layers[r], up);
    else for (let r = layers.length - 2; r >= 0; r--) sortLayer(layers[r], down);
    const c = crossings();
    if (c < bestC) {
      bestC = c;
      best = layers.map((L) => [...L]);
    }
  }
  best.forEach((L, r) => (layers[r] = L));
  index();

  // 5. Across-layer coordinates: least-squares placement toward neighbours with minimum gaps.
  const X = new Map();
  for (const L of layers) {
    let x = 0;
    L.forEach((id, j) => {
      const n = N.get(id);
      if (j) x += across(N.get(L[j - 1])) / 2 + gapBetween(N.get(L[j - 1]), n) + across(n) / 2;
      X.set(id, x);
    });
  }
  function gapBetween(a, b) {
    if (a.dummy || b.dummy) return nodeGap / 2;
    return a.group !== b.group ? nodeGap * 1.6 : nodeGap;
  }
  const place = (L, nbs) => {
    if (!L.length) return;
    const desired = L.map((id) => {
      const ns = nbs.flatMap((nb) => nb.get(id));
      return ns.length ? ns.reduce((s, w) => s + X.get(w), 0) / ns.length : X.get(id);
    });
    const offset = [0];
    for (let j = 1; j < L.length; j++) {
      const a = N.get(L[j - 1]);
      const b = N.get(L[j]);
      offset.push(offset[j - 1] + across(a) / 2 + gapBetween(a, b) + across(b) / 2);
    }
    const z = isotonic(desired.map((d, j) => d - offset[j]));
    L.forEach((id, j) => X.set(id, z[j] + offset[j]));
  };
  for (let it = 0; it < 10; it++) {
    if (it % 2 === 0) for (let r = 1; r < layers.length; r++) place(layers[r], [up]);
    else for (let r = layers.length - 2; r >= 0; r--) place(layers[r], [down]);
  }
  for (let r = 0; r < layers.length; r++) place(layers[r], [up, down]);

  // Rank-axis coordinates. In LR the gap must fit the widest edge label crossing it.
  const labelGap = new Array(layers.length).fill(0);
  for (const e of dag) {
    const lab = edges[e.k].labelSize;
    if (!lab) continue;
    const r = rank.get(e.from);
    labelGap[r] = Math.max(labelGap[r], LR ? lab.w + 24 : lab.h + 22);
  }
  const thick = layers.map((L) => Math.max(0, ...L.map((id) => along(N.get(id)))));
  const Y = [];
  const gapMid = []; // middle of the gap after rank r, on the rank axis: where edge labels go
  let y = 0;
  layers.forEach((_, r) => {
    Y.push(y + thick[r] / 2);
    const gap = Math.max(rankGap, labelGap[r]);
    gapMid.push(y + thick[r] + gap / 2);
    y += thick[r] + gap;
  });

  let minX = Infinity;
  let maxX = -Infinity;
  for (const [id, n] of N) {
    minX = Math.min(minX, X.get(id) - across(n) / 2);
    maxX = Math.max(maxX, X.get(id) + across(n) / 2);
  }
  const P = new Map();
  for (const [id, n] of N) {
    const a = X.get(id) - minX;
    const b = Y[rank.get(id)];
    P.set(id, LR ? { x: b, y: a, w: n.w, h: n.h } : { x: a, y: b, w: n.w, h: n.h });
  }

  // 6. Edge routes in original direction, clipped to node borders.
  const routed = edges.map((e, k) => {
    if (e.from === e.to) {
      const p = P.get(e.from);
      return { ...e, self: true, points: [{ x: p.x + p.w / 2, y: p.y }], labelPos: { x: p.x + p.w / 2 + 18, y: p.y - p.h / 2 - 8 } };
    }
    let chain = chains.get(k);
    if (reversed.has(k)) chain = [...chain].reverse();
    const pts = chain.map((id) => ({ x: P.get(id).x, y: P.get(id).y }));
    pts[0] = border(P.get(chain[0]), pts[1], LR);
    pts[pts.length - 1] = border(P.get(chain[chain.length - 1]), pts[pts.length - 2], LR);
    // The label sits in the first gap the edge crosses, at the curve's height there.
    const r0 = Math.min(rank.get(chain[0]), rank.get(chain[1]));
    const [a, b] = rank.get(chain[0]) <= rank.get(chain[1]) ? [pts[0], pts[1]] : [pts[1], pts[0]];
    const along = gapMid[r0];
    const lift = LR && e.labelSize ? e.labelSize.h / 2 + 3 : 0; // LR: sit above the line, not on it
    const t = LR ? (along - a.x) / (b.x - a.x || 1) : (along - a.y) / (b.y - a.y || 1);
    const cross = LR ? a.y + (b.y - a.y) * smooth(t) : a.x + (b.x - a.x) * smooth(t);
    return { ...e, points: pts, labelPos: LR ? { x: along, y: cross - lift } : { x: cross, y: along } };
  });
  spreadLabels(routed, LR);

  const real = [...P.entries()].filter(([id]) => !N.get(id).dummy);
  const width = LR ? y - Math.max(rankGap, labelGap[layers.length - 1] || 0) : maxX - minX;
  const height = LR ? maxX - minX : y - Math.max(rankGap, labelGap[layers.length - 1] || 0);
  return { nodes: new Map(real), edges: routed, width, height, crossings: bestC };
}

// Point where the edge toward `toward` leaves box `b`. Edges leave from the side that faces the next rank.
function border(b, toward, LR) {
  if (LR) {
    const side = toward.x >= b.x ? 1 : -1;
    return { x: b.x + (side * b.w) / 2, y: b.y + clampTo((toward.y - b.y) * 0.25, b.h / 2 - 4) };
  }
  const side = toward.y >= b.y ? 1 : -1;
  return { x: b.x + clampTo((toward.x - b.x) * 0.25, b.w / 2 - 6), y: b.y + (side * b.h) / 2 };
}
const clampTo = (v, lim) => Math.max(-lim, Math.min(lim, v));
// Position along a cubic with flat tangents at both ends (how edges are drawn), for t in 0..1.
const smooth = (t) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};

// Pool-adjacent-violators: the non-decreasing sequence closest to `y` in least squares.
export function isotonic(y) {
  const blocks = [];
  for (const v of y) {
    blocks.push({ sum: v, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
      const b = blocks.pop();
      blocks[blocks.length - 1].sum += b.sum;
      blocks[blocks.length - 1].n += b.n;
    }
  }
  return blocks.flatMap((b) => new Array(b.n).fill(b.sum / b.n));
}

// Push overlapping edge labels apart along the layer axis.
function spreadLabels(edges, LR) {
  const labeled = edges.filter((e) => e.labelSize && !e.self);
  const key = (e) => (LR ? e.labelPos.y : e.labelPos.x);
  const size = (e) => (LR ? e.labelSize.h + 4 : e.labelSize.w + 10);
  const rankKey = (e) => Math.round(LR ? e.labelPos.x / 8 : e.labelPos.y / 8);
  const buckets = new Map();
  for (const e of labeled) {
    const k = rankKey(e);
    buckets.set(k, [...(buckets.get(k) ?? []), e]);
  }
  for (const group of buckets.values()) {
    group.sort((a, b) => key(a) - key(b));
    for (let j = 1; j < group.length; j++) {
      const prev = group[j - 1];
      const cur = group[j];
      const min = key(prev) + (size(prev) + size(cur)) / 2;
      if (key(cur) < min) {
        if (LR) cur.labelPos.y = min;
        else cur.labelPos.x = min;
      }
    }
  }
}
