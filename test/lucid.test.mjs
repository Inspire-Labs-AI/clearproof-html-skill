import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { parseDraft } from '../skills/lucid/scripts/lib/parse.mjs';
import { md } from '../skills/lucid/scripts/lib/md.mjs';
import { layoutGraph, isotonic } from '../skills/lucid/scripts/lib/layout.mjs';
import { parseFlow } from '../skills/lucid/scripts/lib/components/flow.mjs';
import { parseSequence } from '../skills/lucid/scripts/lib/components/sequence.mjs';
import { renderDraft, fillRows } from '../skills/lucid/scripts/lib/render.mjs';
import { lintDraft } from '../skills/lucid/scripts/lib/lint.mjs';
import { parseUnified } from '../skills/lucid/scripts/lib/git.mjs';
import { DraftError } from '../skills/lucid/scripts/lib/util.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'skills/lucid/scripts/lucid.mjs');

function demoRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'lucid-test-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 1;\nexport const b = 2;\n');
  writeFileSync(join(dir, 'src/b.js'), 'export function f() {\n  return 1;\n}\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  writeFileSync(join(dir, 'src/a.js'), 'export const a = 10;\nexport const b = 2;\n');
  writeFileSync(join(dir, 'src/b.js'), 'export function f() {\n  return 2;\n}\n');
  writeFileSync(join(dir, 'src/new.js'), 'console.log("hi");\n');
  return dir;
}

test('front matter, intro and panels with attributes', () => {
  const d = parseDraft('---\ntitle: T\ntldr: x\n---\nIntro.\n\n## One {span=2 say="hi there" #first}\nBody\n```flow LR\nA -> B\n```\n## Two\nMore');
  assert.equal(d.meta.title, 'T');
  assert.equal(d.intro[0].text.trim(), 'Intro.');
  assert.equal(d.panels.length, 2);
  assert.deepEqual(d.panels[0].attrs, { span: '2', say: 'hi there', id: 'first' });
  assert.equal(d.panels[0].id, 'first');
  assert.equal(d.panels[0].blocks[1].lang, 'flow');
  assert.equal(d.panels[0].blocks[1].args, 'LR');
  assert.equal(d.panels[0].blocks[1].line, 9);
});

test('bad front matter value names the valid choices', () => {
  assert.throws(() => parseDraft('---\nverdict: maybe\n---\n'), (e) => e instanceof DraftError && /approve \| changes/.test(e.message));
  assert.throws(() => parseDraft('```flow\nA -> B\n'), /never closed/);
});

test('markdown: tables with status badges, nested lists, inline escaping', () => {
  const html = md('| A | B |\n|---|---|\n| x | ok fine |\n| y | no |\n\n- one\n  - nested\n- two\n\n<script>alert(1)</script> **b** `c<d`');
  assert.match(html, /st-ok/);
  assert.match(html, /st-no/);
  assert.match(html, /<ul><li>one<ul><li>nested<\/li><\/ul><\/li><li>two<\/li><\/ul>/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /<code>c&lt;d<\/code>/);
  assert.match(md('[x](javascript:alert(1))'), /href="#"/);
});

test('isotonic regression keeps order with least squares', () => {
  assert.deepEqual(isotonic([1, 3, 2, 4]), [1, 2.5, 2.5, 4]);
});

test('layout: no two nodes in a layer overlap, ranks follow edges, cycles survive', () => {
  const nodes = ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, w: 80, h: 30 }));
  const edges = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E'], ['E', 'A']].map(([from, to]) => ({ from, to }));
  for (const dir of ['TB', 'LR']) {
    const L = layoutGraph({ nodes, edges, dir });
    const P = [...L.nodes.values()];
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i];
        const b = P[j];
        const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
        assert.ok(!overlap, `${dir}: nodes overlap`);
      }
    const axis = dir === 'TB' ? 'y' : 'x';
    assert.ok(L.nodes.get('A')[axis] < L.nodes.get('B')[axis]);
    assert.ok(L.nodes.get('D')[axis] < L.nodes.get('E')[axis]);
    assert.equal(L.edges.length, edges.length);
  }
});

test('flow: shapes, fan-out, chains, notes, colons inside node names', () => {
  const g = parseFlow('(Start) -> {Ok?}\n{Ok?} -> *Done & [(DB)]: yes | caption\nA -> B -> C: last\nX --> [(Store: tokens)]: put');
  assert.equal(g.nodes.get('Start').shape, 'round');
  assert.equal(g.nodes.get('Ok?').shape, 'decision');
  assert.equal(g.nodes.get('DB').shape, 'db');
  assert.ok(g.nodes.get('Done').hot);
  const fan = g.edges.filter((e) => e.from === 'Ok?');
  assert.equal(fan.length, 2);
  assert.equal(fan[0].note, 'caption');
  assert.deepEqual(g.edges.filter((e) => e.step === 3).map((e) => e.label), ['', 'last']);
  assert.ok(g.nodes.has('Store: tokens'));
  assert.equal(g.edges.at(-1).label, 'put');
  assert.equal(g.steps, 4);
});

test('sequence: participants, notes, phases, captions; bad line is an error with its line', () => {
  const s = parseSequence('participants: C, S\nC -> S: SYN | starts\nnote S: LISTEN\n== close ==\nS --> C: ACK');
  assert.deepEqual(s.parts, ['C', 'S']);
  assert.equal(s.steps, 2);
  assert.equal(s.rows[0].note, 'starts');
  assert.throws(() => parseSequence('C -> S: ok\nwhat is this'), (e) => e.line === 2);
});

test('grid rows fill so there are no holes', () => {
  assert.deepEqual(fillRows([1, 2, 1, 1], 2), [2, 2, 1, 1]);
  assert.deepEqual(fillRows([1], 2), [2]);
});

test('lint: tldr, long sentences, wordy words, passive voice, walls of text', () => {
  const doc = parseDraft(`---\ntitle: T\n---\n## P\nWe utilize the cache in order to make it fast. The value is computed by the worker. ${'word '.repeat(30)}end.\n\n## Wall\n${'Plain words here. '.repeat(60)}`);
  const rules = lintDraft(doc).map((w) => `${w.rule}:${w.message}`);
  assert.ok(rules.some((r) => r.startsWith('structure:no tldr')));
  assert.ok(rules.some((r) => r.includes('"utilize"')));
  assert.ok(rules.some((r) => r.includes('"in order to"')));
  assert.ok(rules.some((r) => r.startsWith('passive')));
  assert.ok(rules.some((r) => r.startsWith('length')));
  assert.ok(rules.some((r) => r.startsWith('wall')));
});

test('explain page renders every example component into one self-contained file', () => {
  const src = readFileSync(join(ROOT, 'examples/tcp.md'), 'utf8');
  const r = renderDraft(src, { cwd: ROOT });
  assert.equal(r.meta.kind, 'explain');
  assert.equal(r.warnings.length, 0, r.warnings.map((w) => w.message).join('\n'));
  assert.match(r.html, /<svg class="seq"/);
  assert.match(r.html, /<svg class="graph"/);
  assert.match(r.html, /class="quiz"/);
  assert.ok(!/<script src=|<link /.test(r.html), 'no external assets');
  assert.ok(!r.html.includes('[object Object]'));
  assert.match(r.html, /id="lucid-source"/);
});

test('code references are checked against real files', () => {
  const ok = renderDraft('---\ntitle: T\ntldr: x\n---\n## A\nSee [[package.json:1]].\n```code package.json:1-3\n2: name\n```', { cwd: ROOT });
  assert.match(ok.html, /class="ref" href="vscode:\/\/file\/.*package\.json:1" data-snip=/);
  assert.throws(() => renderDraft('## A\nSee [[nope/missing.js:3]].', { cwd: ROOT }), /does not exist/);
  assert.throws(() => renderDraft('## A\n```code package.json:1-99999\n```', { cwd: ROOT }), /out of range/);
  assert.throws(() => renderDraft('## A\n```code package.json:1-3\n9: outside\n```', { cwd: ROOT }), /outside the shown range/);
});

test('review: diff index, hunk notes, coverage, untracked files', () => {
  const dir = demoRepo();
  const index = execFileSync('node', [CLI, 'diff', '--base', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.match(index, /3 files · \+3 −2 · 3 hunks/);
  assert.match(index, /A src\/new\.js \[untracked\]/);

  const draft = '---\ntitle: R\ntldr: Small constant change.\nverdict: approve\nbase: HEAD\n---\n## A\n```diff H1\n+1: a is now 10\n```\n';
  const partial = renderDraft(draft, { cwd: dir });
  assert.equal(partial.meta.kind, 'review');
  assert.equal(partial.coverage.covered, 1);
  assert.deepEqual(partial.warnings.filter((w) => w.rule === 'coverage').map((w) => w.message.split(' ')[0]), ['H2', 'H3']);
  assert.match(partial.html, /1\/3 changes explained/);
  assert.match(partial.html, /not explained/);

  const full = renderDraft(`${draft}\n## B\n[[H2]] and [[H3]] are trivial.`, { cwd: dir });
  assert.equal(full.coverage.covered, 3);
  assert.equal(full.warnings.filter((w) => w.rule === 'coverage').length, 0);

  assert.throws(() => renderDraft('## A\n```diff H9\n```', { cwd: dir, base: 'HEAD' }), /no hunk H9/);
  assert.throws(() => renderDraft('## A\n```diff H1\n+7: nope\n```', { cwd: dir, base: 'HEAD' }), /does not match/);
  assert.throws(() => renderDraft('---\nstyle: strict\nbase: HEAD\ntitle: R\ntldr: x\n---\n## A\n```diff H1\n```', { cwd: dir }), /strict/);
});

test('unified diff parser tracks old and new line numbers', () => {
  const [f] = parseUnified('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,3 +1,3 @@ fn\n a\n-b\n+B\n c\n');
  assert.equal(f.add, 1);
  assert.equal(f.del, 1);
  const lines = f.hunks[0].lines;
  assert.deepEqual(lines.map((l) => [l.t, l.old, l.new]), [[' ', 1, 1], ['-', 2, undefined], ['+', undefined, 2], [' ', 3, 3]]);
});

test('CLI: errors give line, component and a correct example; exit code 1', () => {
  const r = spawnSync('node', [CLI, 'render', '-', '--no-open'], { input: '## A\n```flow\nA -> \n```\n', encoding: 'utf8', env: { ...process.env, LUCID_HOME: mkdtempSync(join(tmpdir(), 'lucid-home-')) } });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /✗ L\d+ \[flow\]/);
  assert.match(r.stdout, /correct example:/);
});

test('CLI: render writes the page and reports sections', () => {
  const home = mkdtempSync(join(tmpdir(), 'lucid-home-'));
  const r = spawnSync('node', [CLI, 'render', join(ROOT, 'examples/tcp.md'), '--no-open'], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, LUCID_HOME: home } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^✓ .*pages\/how-tcp-opens-and-closes-a-connection\.html/m);
  assert.match(r.stdout, /7 sections/);
  const help = spawnSync('node', [CLI, 'help', 'flow'], { encoding: 'utf8' });
  assert.match(help.stdout, /Each arrow line is one playback step/);
});

test('lint quotes the sentence and also reads diff notes and step captions', () => {
  const doc = parseDraft('---\ntitle: T\ntldr: x\n---\n## A\nThe token is checked first.\n```flow\nA -> B: go | The request is rejected here.\n```\n```code package.json:1-3\n2: The name is read by npm.\n```');
  const msgs = lintDraft(doc).filter((w) => w.rule === 'passive').map((w) => w.message);
  assert.equal(msgs.length, 3);
  assert.ok(msgs.every((m) => /in ".+"/.test(m)), msgs.join('\n'));
});

test('sections with wide tables take the full row', () => {
  const r = renderDraft('---\ncols: 2\n---\n## A\n| a | b | c | d |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |\n\n## B\ntext\n\n## C\ntext', { cwd: ROOT });
  assert.match(r.html, /<section class="panel span-full" id="a"/);
  assert.match(r.html, /<section class="panel span-1" id="b"/);
});

test('flow edge labels render above all edge lines', () => {
  const r = renderDraft('## A\n```flow\nA -> B: one\nA -> C: two\n```', { cwd: ROOT });
  const svg = r.html.slice(r.html.indexOf('<svg class="graph"'));
  assert.ok(svg.lastIndexOf('<path d="M') < svg.indexOf('class="elabel"'));
});

test('status badges need a lowercase keyword, so "No such name" stays text', () => {
  const html = md('| a | b |\n|---|---|\n| No such name | no |');
  assert.match(html, /<td>No such name<\/td>/);
  assert.match(html, /st-no/);
});

test('risks rank critical above high', () => {
  const r = renderDraft('## R\n```risks\nhigh | Off by one\ncritical | SQL injection\n```', { cwd: ROOT });
  assert.ok(r.html.indexOf('r-critical') < r.html.indexOf('r-high'));
});

test('run executes only with allowRun, embeds real output and checks expectations', () => {
  const draft = '## P\n```run\n$ node -e "console.log(6*7)"\nexpect: 42\nabsent: Error\n$ node -e "console.log(1)"\nexpect: 2\n```';
  assert.throws(() => renderDraft(draft, { cwd: ROOT }), /--allow-run/);
  const r = renderDraft(draft, { cwd: ROOT, allowRun: true });
  assert.match(r.html, /<pre class="out">42<\/pre>/);
  assert.deepEqual(r.runs.map((x) => x.checks.map((c) => c.ok)), [[true, true], [false]]);
  assert.match(r.html, /exit 0/);
});

test('risks keep indented detail lines under their item', () => {
  const r = renderDraft('## R\n```risks\nhigh | Page 1 skips rows\n  why: offset = page × 20\n  fix: (page − 1) × 20\n```', { cwd: ROOT });
  assert.match(r.html, /<ul class="rdetail"><li>why: offset = page × 20<\/li><li>fix: \(page − 1\) × 20<\/li><\/ul>/);
});

test('claims: verified needs evidence; counts feed the grounding strip', () => {
  assert.throws(() => renderDraft('## C\n```claims\nverified | It is fast\n```', { cwd: ROOT }), /names no evidence/);
  const r = renderDraft('---\ntitle: T\ntldr: x\n---\n## C\nSee [[package.json:1]].\n```claims\nverified | Name is set | [[package.json:2]]\ninferred | Probably fine | no tests\nunverified | Scales\n```', { cwd: ROOT });
  assert.match(r.html, /class="grounding"[^>]*><i>Checked<\/i>/);
  assert.match(r.html, /<b>2<\/b> code references checked/);
  assert.match(r.html, /<b>1<\/b> verified · <b>1<\/b> inferred · <b>1<\/b> unverified claims/);
});

test('code side mode puts notes in a column; overlapping side notes are an error', () => {
  const r = renderDraft('## C\n```code package.json:1-6 side\n2: the name\n3-4: version and description\n```', { cwd: ROOT });
  assert.match(r.html, /figure class="code sbs"/);
  assert.match(r.html, /<td class="side" rowspan="2"><div class="cnote">version and description/);
  assert.throws(() => renderDraft('## C\n```code package.json:1-6 side\n2-4: a\n3: b\n```', { cwd: ROOT }), /overlap/);
});

test('quiz options carry their own explanations', () => {
  const r = renderDraft('## Q\n```quiz\n? Pick one\n- [x] Right :: because\n- [ ] Wrong :: because not\n```', { cwd: ROOT });
  assert.match(r.html, /data-ok="true">Right<span class="owhy" hidden>because<\/span>/);
});

test('diagram parts carry ids so prose names can light them up', () => {
  const r = renderDraft('## A\nThe API calls the DB.\n```flow\nAPI -> DB: query\n```', { cwd: ROOT });
  assert.match(r.html, /class="node box" data-step="1" data-id="API"/);
  assert.match(r.html, /data-from="API" data-to="DB"/);
});

test('run shows: is evidence of behaviour, reported separately from expectations', () => {
  const r = renderDraft('## P\n```run\n$ node -e "console.log(\'offset 20\')"\nshows: offset 20\nexpect: offset 0\n```', { cwd: ROOT, allowRun: true });
  assert.match(r.html, /chk shows ok">✓ output shows “offset 20”/);
  assert.match(r.html, /chk expect no">✗ expected “offset 0” — not in the output/);
  assert.match(r.html, /1 of 1 behaviours reproduced/);
  assert.ok(!/expectations held/.test(r.html));
});

test('reviews warn about quiz and glossary padding', () => {
  const doc = parseDraft('---\ntitle: R\ntldr: x\nkind: review\n---\n## Q\n```quiz\n? a\n= b\n```');
  assert.ok(lintDraft(doc).some((w) => w.rule === 'review' && /quiz/.test(w.message)));
});

test('waffle fills cells in proportion and names the exact numbers', () => {
  const r = renderDraft('## W\n```waffle unit=pages\nScan | 10000 of 10000\nIndex | 4 of 10000 | root to leaf\n```', { cwd: ROOT });
  const rows = r.html.split('class="wrow"').slice(1);
  assert.equal((rows[0].match(/class="on"/g) ?? []).length, 200);
  assert.equal((rows[1].match(/class="on"/g) ?? []).length, 1);
  assert.match(r.html, /4 pages <small>of 10,000 · 0.04%<\/small>/);
  assert.throws(() => renderDraft('## W\n```waffle\nBad | 5 of 4\n```', { cwd: ROOT }), /between 0 and the whole/);
});

test('explain pages default to one reading column', () => {
  const r = renderDraft('## A\ntext\n## B\ntext', { cwd: ROOT });
  assert.match(r.html, /class="grid" style="--cols:1"/);
});

test('record and faded nodes draw real data; chart values must match run output', () => {
  const r = renderDraft('## A\n```flow\n[g; p] -> *[h; m]: kim\n[g; p] --> ~[a; d]\n```', { cwd: ROOT });
  assert.match(r.html, /class="node record" data-step="1" data-id="g; p"><rect[^>]*\/><text[^>]*>g<\/text><line class="div"/);
  assert.match(r.html, /class="node record faded"/);
  const draft = '## M\n```run\n$ node -e "console.log(\'scan 37.07 ms\')"\n```\n```chart bar unit=ms\nScan | 37.07\nIndex | 999\n```';
  const w = renderDraft(draft, { cwd: ROOT, allowRun: true }).warnings.filter((x) => x.rule === 'evidence');
  assert.equal(w.length, 1);
  assert.match(w[0].message, /chart value 999/);
});

test('log-scale charts reject non-positive values', () => {
  assert.throws(() => renderDraft('## C\n```chart bar scale=log\nA | 0\n```', { cwd: ROOT }), /above 0/);
  assert.match(renderDraft('## C\n```chart bar scale=log\nA | 4\nB | 10000\n```', { cwd: ROOT }).html, /Log scale/);
});

test('run output hides machine paths; small waffles use one cell per unit', async () => {
  const { tidyPaths } = await import('../skills/lucid/scripts/lib/components/run.mjs');
  assert.equal(tidyPaths('cat /tmp/claude-0/abc/def/results.txt', '/repo'), 'cat $TMP/results.txt');
  assert.equal(tidyPaths('/repo/src/a.js and /repo', '/repo'), './src/a.js and .');
  const r = renderDraft('## W\n```waffle unit=ints\nOne line | 16 of 16\nUsed by a column walk | 1 of 16\n```', { cwd: ROOT });
  const rows = r.html.split('class="wrow"').slice(1);
  assert.equal((rows[0].match(/<i/g) ?? []).length, 16);
  assert.ok(!/Each square/.test(r.html));
});

test('charts highlight one bar and annotate it in place', () => {
  const r = renderDraft('## C\n```chart bar unit= cycles\nL1 | 4\n*DRAM | 300 ! ≈80 ns, 75× L1\n```', { cwd: ROOT });
  assert.match(r.html, /<rect class="muted"/);
  assert.match(r.html, /<rect class="s0"/);
  assert.match(r.html, /class="anno" dx="10">≈80 ns, 75× L1</);
});

test('figure blocks keep their script as inert text and get numbered captions', () => {
  const r = renderDraft('## F\n```figure caption="Each step reads one cell"\n<div class="row"></div>\n<script>\nL.player(fig, { steps: 3, onStep: () => {} });\n</script>\n```\n```chart bar caption="Second figure"\nA | 1\n```', { cwd: ROOT });
  assert.match(r.html, /data-fig><div class="row"><\/div><script type="text\/plain" class="fig-src">/);
  assert.match(r.html, /<b>Fig\. 1<\/b> Each step reads one cell/);
  assert.match(r.html, /<b>Fig\. 2<\/b> Second figure/);
  assert.throws(() => renderDraft('## F\n```figure\n<script src="x.js"></script>\n```', { cwd: ROOT }), /inline/);
});

test('lint: label headlines, missing figures, x instead of ×; number inventory', async () => {
  const { numberInventory } = await import('../skills/lucid/scripts/lib/lint.mjs');
  const doc = parseDraft('---\ntitle: T\ntldr: x\n---\n## Memory\nIt is 75x slower.\n## Caches\ntext\n## Lines\ntext');
  const rules = lintDraft(doc).map((w) => w.rule);
  assert.ok(rules.includes('headline'));
  assert.ok(rules.includes('figures'));
  assert.ok(rules.includes('typography'));
  assert.deepEqual(numberInventory('A hit is 1 ns. DRAM is 90 ns. Later: 100 ns and 1 ns.'), ['ns: 1 (×2), 90, 100']);
  assert.deepEqual(numberInventory('Young pauses are about 1 ms. Fig: ~1–10 ms each.'), ['ms: 1, 1–10']);
});

test('cases share one layout and mark the changed part', () => {
  const r = renderDraft('## C\n```cases\n# ok | Hit\nApp -> *Cache\n# risk | Miss\nApp -> Cache\nApp -> *DB\n```', { cwd: ROOT });
  const cards = r.html.split('class="case st-').slice(1);
  assert.equal(cards.length, 2);
  assert.match(cards[0], /class="cn faded"><rect[^>]*\/><text[^>]*>DB</);
  assert.match(cards[1], /class="cn is-st"><rect[^>]*\/><text[^>]*>DB</);
  const vb = (c) => c.match(/viewBox="([^"]+)"/)[1];
  assert.equal(vb(cards[0]), vb(cards[1]));
});

test('a headline count must match the risks it introduces', () => {
  const doc = parseDraft('---\ntitle: R\ntldr: x\nkind: review\n---\n## Six problems\n```risks\nhigh | a\n  why: x\nlow | b\n```');
  assert.ok(lintDraft(doc).some((w) => w.rule === 'consistency' && /says 6 but the risks block lists 2/.test(w.message)));
});
