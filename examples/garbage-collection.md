---
kicker: Garbage collection in Java and JavaScript
title: GC pause time grows with what survives, not with the garbage
tldr: The collector keeps what your program can **reach from its roots** and frees the rest. Pauses last about 1 ms for young objects, but seconds for a full stop-the-world collection.
for: a programmer who uses Java or JavaScript and has seen a "GC pause" in a profile
cols: 1
---
## The hero {hero}
```figure caption="Tracing starts at the roots. Everything it cannot reach is garbage — even the cycle A ↔ B." wide
<div class="g"></div>
<script>
const W = 760, H = 285, BW = 150, BH = 36;
const s = L.svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'font-size:13px' });
const N = {
  s: { x: 10, y: 50, t: 'stack: cart', root: 1 }, g: { x: 10, y: 205, t: 'static: config', root: 1 },
  c: { x: 205, y: 50, t: 'Cart #41', live: 1 }, p: { x: 400, y: 15, t: 'Item "pen"', live: 1 },
  i: { x: 400, y: 95, t: 'Item "ink"', live: 1 }, f: { x: 205, y: 205, t: 'Config', live: 1 },
  m: { x: 400, y: 205, t: 'Map (cache)', live: 1 }, o: { x: 600, y: 15, t: 'Cart #40 (old)' },
  k: { x: 600, y: 95, t: 'Item "cap"' }, a: { x: 600, y: 175, t: 'Node A' }, b: { x: 600, y: 240, t: 'Node B' },
};
const E = [['s','c'],['c','p'],['c','i'],['g','f'],['f','m'],['o','k'],['o','i'],['a','b'],['b','a']];
const defs = L.svg('defs', {}, L.svg('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
  L.svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: L.color('ink-3') })));
s.append(defs);
for (const [u, v] of E) {
  const A = N[u], B = N[v]; let d;
  if (A.x === B.x) { const dx = A.y < B.y ? 50 : 100; d = `M${A.x+dx},${A.y < B.y ? A.y+BH : A.y} L${B.x+dx},${A.y < B.y ? B.y : B.y+BH}`; }
  else if (B.x < A.x) d = `M${A.x},${A.y+BH/2} L${B.x+BW},${B.y+BH/2}`;
  else d = `M${A.x+BW},${A.y+BH/2} L${B.x},${B.y+BH/2}`;
  s.append(L.svg('path', { d, stroke: L.color('ink-3'), 'stroke-width': 1.5, fill: 'none', 'marker-end': 'url(#ah)' }));
}
const g1 = L.svg('g', { 'data-s': 1 }), g2 = L.svg('g', { 'data-s': 2 }), g3 = L.svg('g', { 'data-s': 3 });
for (const n of Object.values(N)) {
  s.append(L.svg('rect', { x: n.x, y: n.y, width: BW, height: BH, rx: 6, fill: L.color('node'), stroke: L.color('line') }));
  s.append(L.svg('text', { x: n.x + 10, y: n.y + 23, fill: L.color('ink') }, n.t));
  if (n.root) g1.append(L.svg('rect', { x: n.x-3, y: n.y-3, width: BW+6, height: BH+6, rx: 8, fill: 'none', stroke: L.color('accent'), 'stroke-width': 3 }));
  if (n.live) g2.append(L.svg('rect', { x: n.x, y: n.y, width: BW, height: BH, rx: 6, fill: L.color('accent'), opacity: 0.18 }),
    L.svg('text', { x: n.x + BW - 22, y: n.y + 23, fill: L.color('accent'), 'font-weight': 700 }, '✓'));
  if (!n.root && !n.live) g3.append(L.svg('rect', { x: n.x, y: n.y, width: BW, height: BH, rx: 6, fill: 'none', stroke: L.color('risk'), 'stroke-width': 2, 'stroke-dasharray': '5 4' }),
    L.svg('text', { x: n.x + BW - 44, y: n.y + 23, fill: L.color('risk'), 'font-weight': 700 }, 'freed'));
}
g1.append(L.svg('text', { x: 12, y: 30, fill: L.color('accent'), 'font-weight': 700 }, 'GC roots'));
g2.append(L.svg('text', { x: 205, y: 160, fill: L.color('accent'), 'font-weight': 700 }, '✓ = reached, so kept'));
g3.append(L.svg('text', { x: 600, y: 160, fill: L.color('risk'), 'font-weight': 700 }, 'no path from a root'));
s.append(g1, g2, g3);
fig.querySelector('.g').append(s);
L.steps(fig, [
  'The heap: 9 objects with references between them. The collector cannot ask the program which ones it still needs.',
  'Roots are the starting points: local variables on each thread stack, static fields (Java) or globals (JS), and registers.',
  'Mark: follow every reference from the roots. Cart #41, both items, Config and the Map get a mark.',
  'Sweep: the 4 unmarked objects are freed. Cart #40 points at "ink", but nothing points at Cart #40, so it dies.',
]);
</script>
```

## Four parts do the work {kicker="Names first"}
- **Roots** — stack variables, static fields or globals, and CPU registers.
- **Mark** — follow references from the roots and flag every object reached.
- **Sweep or copy** — reclaim unflagged memory, or copy flagged objects to a fresh area.
- **Safepoint** — a point where every app thread has stopped, so references cannot change during a step that needs a frozen heap.

Reference counting alone cannot free the cycle A ↔ B: each node still has a count of 1. Java and JavaScript engines use tracing, so the cycle goes.

## Most objects die young, so the young generation is collected by copying the few survivors {kicker="Mechanism" span=full}
Both HotSpot (Java) and V8 (JavaScript) split the heap. New objects go to a small **young generation**. Objects that survive a few collections move to the **old generation**.

```quiz
? Eden is full: 10 objects, of which 8 are already garbage. Where does the minor collection spend its time?
- [ ] Freeing the 8 dead objects one by one :: A copying collector never visits dead objects. It abandons the whole area at once.
- [x] Copying the 2 live objects :: Correct. Work is proportional to survivors, so a young collection with few survivors is short.
- [ ] Scanning the whole old generation :: A "remembered set" records old→young references, so the old generation is not traced.
```

```figure caption="A minor GC copies 2 survivors and wipes eden. The 8 dead objects cost nothing. Illustrative sizes." wide
<div class="rows" style="display:grid;gap:10px"></div>
<script>
const rows = fig.querySelector('.rows');
const names = ['req','json','str','buf','tmp','user','str','arr','tmp','sess'];
const live = new Set([5, 9]);
const mk = (label) => { const cells = L.el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' });
  rows.append(L.el('div', { style: 'display:grid;grid-template-columns:200px 1fr;align-items:center;gap:8px' },
    L.el('span', { class: 'mono' }, label), cells)); return cells; };
const eden = mk('Eden (young)'), surv = mk('Survivor (young)'), old = mk('Old generation');
const app = L.readout(fig, 'App threads'), cp = L.readout(fig, 'Objects copied');
const cell = (t, cls = '') => L.el('span', { class: 'cell ' + cls, style: 'min-width:52px;text-align:center' }, t);
const fill = (row, items, size) => { row.replaceChildren(...items, ...Array.from({ length: size - items.length }, () => cell('·', 'dim'))); };
const render = (st) => {
  const e = st === 0 ? names.slice(0, 4) : st <= 2 ? names : [];
  fill(eden, e.map((n, i) => cell(n, st === 2 ? (live.has(i) ? 'hit' : 'dim') : st === 1 ? 'on' : '')), 10);
  const sv = st === 3 ? [cell('user ·1', 'hit'), cell('sess ·1', 'hit')] : st === 4 ? [cell('cart ·1', 'hit')] : [];
  fill(surv, sv, 4);
  const o = [cell('Config'), cell('Map')]; if (st === 4) o.push(cell('user ·2', 'hit'));
  fill(old, o, 6);
  app.set(st === 1 || st === 2 ? 'PAUSED (stop-the-world)' : 'running');
  cp.set(st === 3 ? '2 of 10' : st === 4 ? '2 (1 promoted)' : '0');
};
const p = L.player(fig, { steps: 5, onStep: render, interval: 1400, labels: [
  'Allocate: each request creates short-lived objects in eden (4 of 10 slots used).',
  'Eden is full (10 of 10). Allocation fails, so the JVM or V8 pauses the app threads at a safepoint.',
  'Trace from roots plus the remembered set: only "user" and "sess" are reachable. 8 of 10 are garbage.',
  'Copy the 2 survivors to the survivor space (age 1) and reset eden as empty. The pause ends.',
  'Next minor GC: "user" survives again and is promoted to the old generation; "sess" died.',
] });
p.go(3);
</script>
```

```callout info What we simplified
Real eden sizes are megabytes to gigabytes, not 10 slots. V8 calls this the Scavenger and uses two semi-spaces; HotSpot uses eden plus two survivor spaces. The promotion age here (2) is illustrative.
```

## Pauses happen when the collector needs a heap that cannot change {kicker="When it pauses" span=full}
Marking while the app runs is unsafe: the app could move the only reference to an object into an already-scanned object. Collectors handle this in one of three ways. The choice decides how long your longest pause is.

```figure caption="Same heap, three collector designs. Red = app threads stopped. Pause length tracks live data only for stop-the-world full GC. Illustrative model." wide
<div class="tl"></div>
<script>
const W = 760, X0 = 110, SC = 64; // 10 s window, 64 px per second
const box = fig.querySelector('.tl');
const longest = L.readout(fig, 'Longest pause'), total = L.readout(fig, 'Time paused in 10 s');
let mode = 0, live = 8;
const fmt = (s) => s >= 1 ? s.toFixed(1) + ' s' : s >= 0.01 ? Math.round(s * 1000) + ' ms' : (s * 1000).toFixed(1) + ' ms';
function model(mode, gb) {
  if (mode === 0) { const d = gb / 4; return { pauses: [[0.5, 0.02], [1, d]].filter(([t]) => t < 10), conc: [] }; }
  if (mode === 1) { const m = Math.min(gb * 0.4, 7);
    return { pauses: [[1, 0.02], [3, 0.02], [5, 0.02], [7, 0.02], [9, 0.02], [1.5 + m, 0.005 + gb * 0.001]], conc: [[1.5, m]] }; }
  const m = Math.min(gb * 0.5, 8);
  return { pauses: [[1, 0.0005], [1 + m / 2, 0.0005], [1 + m, 0.0005]], conc: [[1, m]] };
}
function draw() {
  const { pauses, conc } = model(mode, live);
  const s = L.svg('svg', { viewBox: `0 0 ${W} 150`, width: '100%', style: 'font-size:13px' });
  const lane = (y, label) => { s.append(L.svg('text', { x: 0, y: y + 18, fill: L.color('ink') }, label),
    L.svg('rect', { x: X0, y, width: 10 * SC, height: 26, fill: L.color('node'), stroke: L.color('line') })); };
  lane(20, 'App threads'); lane(70, 'GC threads');
  s.append(L.svg('rect', { x: X0, y: 20, width: 10 * SC, height: 26, fill: L.color('ok'), opacity: 0.25 }));
  for (const [t, d] of conc) s.append(L.svg('rect', { x: X0 + t * SC, y: 70, width: d * SC, height: 26, fill: L.color('accent'), opacity: 0.45 }),
    L.svg('text', { x: X0 + t * SC + 6, y: 88, fill: L.color('ink') }, 'concurrent mark' + (mode === 2 ? ' + relocate' : '')));
  let mx = 0, sum = 0;
  for (const [t, d] of pauses) { mx = Math.max(mx, d); sum += Math.min(d, 10 - t);
    const w = Math.max(3, Math.min(d, 10 - t) * SC);
    s.append(L.svg('rect', { x: X0 + t * SC, y: 20, width: w, height: 26, fill: L.color('risk') }),
      L.svg('rect', { x: X0 + t * SC, y: 70, width: w, height: 26, fill: L.color('risk'), opacity: 0.7 })); }
  const [lt] = pauses.find(([, d]) => d === mx);
  s.append(L.svg('text', { x: Math.min(X0 + lt * SC, W - 150), y: 14, fill: L.color('risk'), 'font-weight': 700 }, '▼ ' + fmt(mx) + ' pause'));
  for (let i = 0; i <= 10; i += 2) s.append(L.svg('text', { x: X0 + i * SC, 'text-anchor': i === 10 ? 'end' : i ? 'middle' : 'start', y: 120, fill: L.color('ink-3') }, i + ' s'));
  box.replaceChildren(s); longest.set(fmt(mx)); total.set(fmt(sum));
}
L.toggle(fig, ['Stop-the-world full GC (Serial, Parallel)', 'Mostly concurrent (G1, V8 old gen)', 'Concurrent compacting (ZGC, Shenandoah)'], (i) => { mode = i; draw(); });
L.slider(fig, { label: 'Live data in old gen', min: 1, max: 32, step: 1, value: 8, format: (v) => v + ' GB' }, (v) => { live = v; draw(); });
draw();
</script>
```

- **Stop-the-world:** mark and compact the whole heap while every app thread waits. In this model, 8 GB of live data at 4 GB/s gives a 2 s pause.
- **Mostly concurrent:** mark while the app runs. A **write barrier** logs reference changes, and a short final pause fixes up the rest.
- **Concurrent compacting:** also move objects while the app runs, using load barriers. Pauses stay under 1 ms, but GC threads take CPU time.

## A 200 ms pause misses 12 frames of a 60 fps page {kicker="Numbers"}
```chart bar unit=ms scale=log caption="Pause sizes span four orders of magnitude. Compare each one with the 16.7 ms frame budget."
ZGC pause goal | 1 ! under 1 ms (JEP 439)
Browser frame at 60 fps | 16.7
*G1 default pause goal | 200 ! -XX:MaxGCPauseMillis default
Full GC, 8 GB live (illustrative) | 2000 ! at 4 GB/s
```
JavaScript runs your code on one main thread. Any GC work on that thread delays input and rendering. V8 hides most of it with parallel scavenges, concurrent marking and GC work scheduled in idle time between frames.

## Long pauses come from a few known triggers {kicker="Where it breaks" span=full}
```figure caption="The same 10 s of app time under four triggers. Red = app stopped. Only the first is routine. Illustrative." wide
<div class="cs" style="display:grid;gap:12px"></div>
<script>
const C = [
  ['ok', 'Minor GC, few survivors', '~1–10 ms each, often', [[1, .01], [3, .01], [5, .01], [7, .01], [9, .01]]],
  ['warn', 'Old gen fills before concurrent mark ends', 'falls back to a full GC', [[1, .01], [3, .01], [4, 1.2]]],
  ['warn', 'Allocation outruns the collector', 'threads stall waiting for memory', [[2, .15], [2.6, .2], [3.4, .3], [6, .25]]],
  ['risk', 'Huge live set, stop-the-world collector', '16 GB live ≈ 4 s', [[1, 4]]],
];
const box = fig.querySelector('.cs');
for (const [st, title, note, ps] of C) {
  const s = L.svg('svg', { viewBox: '0 0 400 26', width: '100%', preserveAspectRatio: 'none', style: 'height:22px' });
  s.append(L.svg('rect', { x: 0, y: 0, width: 400, height: 26, fill: L.color('ok'), opacity: 0.25 }));
  for (const [t, d] of ps) s.append(L.svg('rect', { x: t * 40, y: 0, width: Math.max(3, d * 40), height: 26, fill: L.color('risk') }));
  box.append(L.el('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:center' },
    L.el('div', { style: 'text-align:left' }, L.el('span', { class: 'tag' }, st.toUpperCase()), ' ', L.el('b', {}, title), L.el('div', { class: 'muted', style: 'text-align:left' }, note)), s));
}
</script>
```

| Symptom | Cause | Try |
|---|---|---|
| Short regular pauses | minor GC | ok Usually fine |
| Rare multi-second pause | full GC | no G1 or ZGC; find leaks |
| Janky JS animation | GC in a frame | warn Reuse objects |
| Memory grows forever | reachable leak | no Find the root |

## What to remember {kicker="Summary"}
```callout key Four rules
1. GC frees only unreachable objects. A forgotten cache entry or listener is a leak the GC cannot fix.
2. Young collections are cheap because their cost is the survivors, not the garbage.
3. Long pauses come from stop-the-world work on the old generation. Concurrent collectors shrink them by doing that work while your code runs.
4. Lower pauses cost CPU and memory: barriers slow each write or read, and GC threads compete with your threads.
```

```quiz
? A Java service on the Parallel collector has 16 GB of live data and pauses for 4 s. You double the heap to 64 GB. What happens to the full-GC pause?
- [ ] It halves :: A bigger heap makes full GCs less frequent, but each one still traces all 16 GB of live data.
- [x] Full GCs come less often, but each one is still about as long :: Correct. Stop-the-world pause tracks live data, so switch to G1 or ZGC to shorten it.
- [ ] It disappears :: The old generation still fills eventually, and the Parallel collector compacts it with the app stopped.

? A web game creates a new {x, y} object for every particle on every frame. What is the risk?
- [x] Frequent young-gen collections on the main thread, which can push frames past 16.7 ms :: Correct. Reusing objects removes the allocation that triggers them.
- [ ] A memory leak :: The objects become unreachable after the frame, so they are collected. The cost is time, not memory.
- [ ] Nothing, because JavaScript has no GC pauses :: V8 does pause the main thread, though it keeps most pauses short.

? You remove an item from a list but keep it in a Map used as a cache. Will the GC free it?
- [ ] Yes, it is no longer in the list :: The Map still holds a reference, and the Map is reachable from a root.
- [x] No — it is still reachable through the Map :: Correct. Use a WeakMap (JS) or WeakReference/WeakHashMap (Java) if the cache should not keep it alive.
```

## Glossary
```glossary
Root: A reference the program holds directly: a stack variable, a static field, a global, or a register.
Stop-the-world (STW): A GC phase that runs while every application thread is paused.
Safepoint: A place in the code where a thread can stop so the collector sees a consistent heap.
Write barrier: Code the runtime adds to each reference store, so a concurrent collector learns about changes.
Promotion: Moving an object that survived several young collections into the old generation.
Remembered set: A record of old→young references, so a minor GC does not need to scan the old generation.
```

## Sources
- Oracle, [HotSpot Virtual Machine Garbage Collection Tuning Guide (JDK 21)](https://docs.oracle.com/en/java/javase/21/gctuning/) — generations, G1 pause goal (`MaxGCPauseMillis` = 200 ms), Parallel and Serial collectors.
- OpenJDK, [JEP 439: Generational ZGC](https://openjdk.org/jeps/439) and [ZGC wiki](https://wiki.openjdk.org/display/zgc) — sub-millisecond pause goal.
- V8 blog, [Trash talk: the Orinoco garbage collector](https://v8.dev/blog/trash-talk) — Scavenger, concurrent marking, parallel compaction.
- V8 blog, [Free garbage collection](https://v8.dev/blog/free-garbage-collection) — GC scheduled in idle time between frames.
- MDN, [Memory management in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_management) — reachability, mark-and-sweep, cycles.
