// Draft -> one self-contained HTML file.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDraft } from './parse.mjs';
import { md, inline } from './md.mjs';
import { COMPONENTS, RAW } from './components/index.mjs';
import { createRepo } from './repo.mjs';
import { loadDiff, repoRoot } from './git.mjs';
import { hunkTable } from './components/diff.mjs';
import { lintDraft } from './lint.mjs';
import { esc, DraftError, slug } from './util.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const asset = (name) => readFileSync(join(HERE, '..', 'assets', name), 'utf8');
export const VERSION = '0.1.0';

const VERDICT = { approve: ['Approve', 'ok'], changes: ['Changes needed', 'warn'], discuss: ['Discuss first', 'info'], block: ['Do not merge', 'risk'] };

export function renderDraft(source, opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const doc = parseDraft(source);
  const meta = { ...doc.meta, ...Object.fromEntries(Object.entries(opts.meta ?? {}).filter(([, v]) => v !== undefined)) };
  const usesDiff = [...doc.intro, ...doc.panels.flatMap((p) => p.blocks)].some((b) => b.type === 'fence' && ['diff', 'changemap'].includes(b.lang));
  meta.kind ??= usesDiff ? 'review' : 'explain';
  const review = meta.kind === 'review';

  const root = repoRoot(cwd) ?? cwd;
  const repo = createRepo(root, { link: meta.link });
  let diffCache = null;
  let seq = 0;
  const ctx = {
    repo,
    covered: new Set(),
    runs: [],
    allowRun: Boolean(opts.allowRun),
    glossary: [],
    stats: {},
    uid: () => `l${++seq}`,
    diff: () => (diffCache ??= loadDiff(cwd, meta.base || opts.base)),
    line: 0,
    ref(r) {
      if (/^H\d+$/i.test(r)) {
        const id = r.toUpperCase();
        const h = ctx.diff().hunks.find((x) => x.id === id);
        if (!h) throw new DraftError(`[[${r}]]: there is no hunk ${id}`, { line: ctx.line, component: 'ref' });
        ctx.covered.add(id);
        return `<a class="ref hunk" href="#all-${id}">${id}</a>`;
      }
      return repo.chip(r, ctx.line);
    },
  };

  const renderBlocks = (blocks) =>
    blocks
      .map((b) => {
        ctx.line = b.line;
        if (b.type === 'md') {
          try {
            return `<div class="prose">${md(b.text, ctx)}</div>`;
          } catch (e) {
            if (e instanceof DraftError && !e.line) e.line = b.line;
            throw e;
          }
        }
        if (RAW.has(b.lang)) return `<div class="raw">${b.text}</div>`;
        const comp = COMPONENTS.get(b.lang);
        if (!comp) return `<pre class="block"><code${b.lang ? ` data-lang="${esc(b.lang)}"` : ''}>${esc(b.text)}</code></pre>`;
        ctx.stats[b.lang] = (ctx.stats[b.lang] ?? 0) + 1;
        try {
          return comp.render(b.text, { ...ctx, args: b.args, line: b.line });
        } catch (e) {
          if (!(e instanceof DraftError)) throw e;
          // Component lines are relative to the fence body; the fence line itself is b.line.
          e.line = e.component === 'ref' && e.line ? e.line : b.line + (e.line || 0);
          e.component ||= b.lang;
          e.example ||= comp.example;
          throw e;
        }
      })
      .join('\n');

  const introHtml = renderBlocks(doc.intro);
  const panels = doc.panels.map((p) => ({ ...p, html: renderBlocks(p.blocks) }));

  // Review pages account for every hunk: an appendix lists all of them, and lint reports the unexplained ones.
  let coverage = null;
  let appendix = '';
  if (review) {
    const diff = ctx.diff();
    const missing = diff.hunks.filter((h) => !ctx.covered.has(h.id));
    coverage = { total: diff.hunks.length, covered: diff.hunks.length - missing.length, missing, diff };
    appendix = `<section class="panel span-full appendix" id="all-changes" data-say="Every change in this diff is listed here, so nothing is hidden."><h2><span class="num">∑</span> All changes <small>${diff.hunks.length} hunks · ${diff.files.length} files</small></h2>${diff.files
      .map((f) => `<h3 class="afile"><code>${esc(f.path)}</code> <span class="stat"><b class="a">+${f.add}</b> <b class="d">−${f.del}</b></span></h3>${f.hunks
        .map((h) => `<details id="all-${h.id}" class="${ctx.covered.has(h.id) ? 'covered' : 'uncovered'}"><summary><span class="hid">${h.id}</span> L${h.newStart} ${esc(h.header.trim())} <span class="stat"><b class="a">+${h.add}</b> <b class="d">−${h.del}</b></span> ${ctx.covered.has(h.id) ? '<span class="tag ok">explained</span>' : '<span class="tag no">not explained</span>'}</summary><figure class="code diff"><div class="scroll"><table>${hunkTable(h)}</table></div></figure></details>`)
        .join('')}`)
      .join('')}</section>`;
  }

  const warnings = meta.style === 'off' ? [] : lintDraft({ ...doc, meta }, { coverage });
  if (meta.style === 'strict' && warnings.length) {
    const err = new DraftError(`style: strict and ${warnings.length} readability/coverage problems`, { component: 'lint' });
    err.warnings = warnings;
    throw err;
  }

  const html = page({ meta, introHtml, panels, appendix, coverage, review, source, glossary: ctx.glossary, ctx });
  return { html, warnings, meta, coverage, runs: ctx.runs, stats: { panels: panels.length, components: ctx.stats } };
}

// Make lone panels fill their row so the grid has no holes.
export function fillRows(spans, cols) {
  let used = 0;
  return spans.map((span, i) => {
    span = Math.min(span, cols);
    if (used + span > cols) used = 0;
    used += span;
    const next = spans[i + 1] === undefined ? undefined : Math.min(spans[i + 1], cols);
    const fill = next === undefined || used + next > cols ? cols - used : 0;
    used = fill || used === cols ? 0 : used;
    return span + fill;
  });
}

const plain = (mdText) =>
  mdText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*\|.*$/gm, '') // tables do not read aloud well
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|]/g, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

function narration(p) {
  if (p.attrs.say) return p.attrs.say;
  const first = p.blocks.find((b) => b.type === 'md' && plain(b.text));
  const text = first ? plain(first.text) : '';
  const cut = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  return cut || p.title;
}

function page({ meta, introHtml, panels, appendix, coverage, review, source, glossary }) {
  const cols = Math.max(1, Math.min(Number(meta.cols) || (review ? 1 : 2), 3));
  // Tables with 4+ columns, or long cells, need the full row; authors can still set span themselves.
  const wide = (p) =>
    p.blocks.some((b) => b.type === 'md' && b.text.split('\n').some((l) => /^\s*\|/.test(l) && (l.split('|').length - 2 >= 4 || l.length > 110))) ||
    p.blocks.some((b) => b.type === 'fence' && (b.lang === 'sequence' || b.lang === 'code' || b.lang === 'diff' || (['flow', 'changemap'].includes(b.lang) && /\bLR\b/.test(b.args))));
  const spans = fillRows(panels.map((p) => (p.attrs.span === 'full' ? cols : Number(p.attrs.span) || (wide(p) ? cols : 1))), cols);
  const sections = panels
    .map((p, i) => `<section class="panel${spans[i] >= cols ? ' span-full' : ` span-${spans[i]}`}" id="${esc(p.id)}" data-say="${esc(narration(p))}"><h2><span class="num">${i + 1}</span> ${inline(p.title)}${p.attrs.meta ? ` <small>${esc(p.attrs.meta)}</small>` : ''}</h2>${p.html}</section>`)
    .join('\n');
  const toc = panels.length >= 3 || review
    ? `<nav class="toc" aria-label="Contents"><p>Contents</p><ol>${panels.map((p) => `<li><a href="#${esc(p.id)}">${inline(p.title)}</a></li>`).join('')}${review ? '<li class="all"><a href="#all-changes">All changes</a></li>' : ''}</ol></nav>`
    : '';
  const known = new Set(['title', 'subtitle', 'tldr', 'kind', 'cols', 'mode', 'style', 'base', 'verdict', 'link', 'lang']);
  const chips = Object.entries(meta).filter(([k]) => !known.has(k)).map(([k, v]) => `<span class="chip"><b>${esc(k)}</b> ${inline(v)}</span>`);
  let reviewHead = '';
  if (review && coverage) {
    const d = coverage.diff;
    const [vText, vCls] = VERDICT[meta.verdict] ?? [];
    const pct = coverage.total ? Math.round((coverage.covered / coverage.total) * 100) : 100;
    reviewHead = `<div class="review-head">${vText ? `<span class="verdict v-${vCls}">${vText}</span>` : ''}<span class="chip"><b>base</b> <code>${esc(d.base.sha ? d.base.sha.slice(0, 10) : 'none')}</code>${d.base.sha && d.base.sha.startsWith(d.base.label) ? '' : ` ${esc(d.base.label)}`}</span><span class="chip"><b>${d.files.length}</b> files <b class="a">+${d.add}</b> <b class="d">−${d.del}</b></span><a class="coverage${coverage.missing.length ? ' partial' : ''}" href="#all-changes" title="Hunks shown or referenced in the walkthrough"><span class="meter"><i style="width:${pct}%"></i></span> ${coverage.covered}/${coverage.total} changes explained</a></div>`;
  }
  const mode = meta.mode && meta.mode !== 'auto' ? ` data-theme="${meta.mode}"` : '';
  const title = meta.title || panels[0]?.title || 'Lucid page';
  return `<!doctype html>
<html lang="${esc(meta.lang || 'en')}"${mode}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="lucid ${VERSION}">
<title>${esc(title)}</title>
<style>
${asset('style.css')}
</style>
</head>
<body class="kind-${review ? 'review' : 'explain'}">
<div class="topbar"><span class="brand">lucid</span><span class="tb-title">${esc(title)}</span><span class="tb-actions"><button type="button" data-act="tour" title="Narrated walkthrough of this page">▶ Tour</button><button type="button" data-act="theme" title="Switch light / dark">Theme</button><button type="button" data-act="source" title="Copy the draft that made this page">Copy draft</button></span></div>
<header class="hero">
<h1>${inline(title)}</h1>
${meta.subtitle ? `<p class="sub">${inline(meta.subtitle)}</p>` : ''}
${reviewHead}
${meta.tldr ? `<div class="tldr"><span>In one line</span><p>${inline(meta.tldr)}</p></div>` : ''}
${introHtml ? `<div class="intro">${introHtml}</div>` : ''}
${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
</header>
<div class="layout${toc ? ' has-toc' : ''}">
${toc}
<main class="grid" style="--cols:${cols}">
${sections}
${appendix}
</main>
</div>
<div class="tourbar" hidden><button type="button" data-act="tprev" aria-label="Previous">‹</button><button type="button" data-act="tpause" aria-label="Pause">❚❚</button><button type="button" data-act="tnext" aria-label="Next">›</button><p class="tcap" aria-live="polite"></p><button type="button" data-act="tstop" aria-label="Close tour">✕</button></div>
<div class="snip" role="tooltip" hidden></div>
<footer>Made with lucid ${VERSION} · ${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))}</footer>
<script type="application/json" id="lucid-glossary">${JSON.stringify(Object.fromEntries(glossary)).replace(/</g, '\\u003c')}</script>
<script type="text/plain" id="lucid-source">${esc(source)}</script>
<script>
${asset('runtime.js')}
</script>
</body>
</html>
`;
}

export { slug };
