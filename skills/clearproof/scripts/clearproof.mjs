#!/usr/bin/env node
// clearproof: turn a short draft into a page a human can understand quickly.
// Usage: node clearproof.mjs <command> [...]. Run "node clearproof.mjs help" for the list.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { spawn } from 'node:child_process';
import { renderDraft, VERSION } from './lib/render.mjs';
import { loadDiff, formatDiffIndex } from './lib/git.mjs';
import { COMPONENTS } from './lib/components/index.mjs';
import { formatWarning, numberInventory } from './lib/lint.mjs';
import { DraftError, slug } from './lib/util.mjs';
import { parseDraft } from './lib/parse.mjs';

const HELP = `clearproof ${VERSION} — answers and code reviews as pages people can understand fast

  clearproof render <draft.md | -> [options]   draft -> one HTML file (prints ✓ path)
      -o, --out <file>      output path (default: $CLEARPROOF_HOME/pages/<title>.html)
      --check               also open it in headless Chromium, report layout problems, save a screenshot
      --open / --no-open    open in the browser (default: open on a desktop, never in CI or over SSH)
      --base <rev>          review: diff base (default: merge-base with the default branch)
      --mode <auto|light|dark>
      --allow-run           execute run blocks (real command output on the page)
  clearproof diff [--base <rev>] [--brief] [--max-lines N]
                                          index of the change: files, hunk ids (H1, H2, ...) and their lines
  clearproof check <page.html> [--shot <png>] [--section <n|id>]
                                          layout check + screenshots; --section saves a sharp close-up
  clearproof video <page.html> [-o out.mp4] [--voice auto|elevenlabs|say|espeak|none]
                                          narrated explainer video of the page's tour
  clearproof lint <draft.md>                   readability and coverage warnings only
  clearproof list                              components
  clearproof help <component|format|review>    syntax for one topic
`;

const FORMAT = `Draft format

---
title: How TCP opens a connection          required
tldr: Three messages prove both sides can send and receive.   required: the answer in one line
subtitle: optional line under the title
kind: explain | review                     review is automatic when the draft uses diff/changemap
verdict: approve | changes | discuss | block      review only
base: <git rev>                            review only; copy it from "clearproof diff"
cols: 2                                    grid columns (explain: 2, review: 1)
style: warn | strict | off                 readability checks (default warn)
any-other-key: shown as a chip under the title
---
Optional intro paragraph.

## Section title {span=2 say="What the tour narrator says here"}
Markdown: paragraphs, lists, tables (cells starting with ok / no / warn get ✓ ✗ ! badges),
> quotes, **bold**, \`code\`, [links](https://...), and [[src/file.js:40-52]] code references
(real code, previewed on hover; clearproof fails if the file or lines do not exist). [[H3]] cites a diff hunk.

\`\`\`<component> args
component body
\`\`\`

Section attributes: span=2 | span=full, say="narration", meta="small right-aligned note", #custom-id.
Plain fences (\`\`\`js) show code you wrote yourself. \`\`\`html and \`\`\`svg embed raw markup (last resort).`;

const REVIEW = `Review workflow (understanding a change, not just reading it)

1. clearproof diff                 read the index: files, hunk ids, the changed lines
2. write a draft that walks the reader from intent to risk:
     tldr + verdict             what changed and whether it is safe, in one line
     Intent                     why the change exists (from the request, commits, or the code)
     \`\`\`changemap              the shape of the change; add arrows for how files connect
     Walkthrough sections       one per idea, in the order data flows (not file order),
                                each with \`\`\`diff H#  and notes on the lines that matter
     \`\`\`risks                  ranked: what could break, where
     \`\`\`checklist              what a human must still verify
     \`\`\`quiz                   optional: check the reviewer understood the change
3. clearproof render --check       every hunk must be shown (\`\`\`diff) or cited ([[H#]]); unexplained hunks are warned
                              and flagged in the "All changes" appendix that every review page gets.`;

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') opts.out = argv[++i];
    else if (a === '--shot') opts.shot = argv[++i];
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--mode') opts.mode = argv[++i];
    else if (a === '--voice') opts.voice = argv[++i];
    else if (a === '--section') opts.section = argv[++i];
    else if (a === '--max-lines') opts.maxLines = Number(argv[++i]);
    else if (a.startsWith('--')) opts[a.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = true;
    else opts._.push(a);
  }
  return opts;
}

const home = () => process.env.CLEARPROOF_HOME || join(homedir(), '.clearproof');
const readDraft = (p) => (p === '-' || !p ? readFileSync(0, 'utf8') : readFileSync(resolve(p), 'utf8'));

function shouldOpen(opts) {
  if (opts.noOpen) return false;
  if (opts.open) return true;
  if (process.env.CLEARPROOF_OPEN === '0' || process.env.CI || process.env.SSH_CONNECTION) return false;
  if (process.env.CLEARPROOF_OPEN === '1') return true;
  return platform() === 'darwin' || platform() === 'win32' || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}
function openFile(file) {
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform() === 'win32' ? ['/c', 'start', '', file] : [file];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch { /* no browser available */ }
}

function printError(e, src) {
  if (!(e instanceof DraftError)) throw e;
  const where = e.line ? `L${e.line}` : 'draft';
  console.log(`✗ ${where}${e.component ? ` [${e.component}]` : ''} ${e.message}`);
  if (e.line && src) {
    const lines = src.split('\n');
    console.log(`  ${e.line} | ${lines[e.line - 1] ?? ''}`);
  }
  if (e.example) console.log(`  correct example:\n${e.example.replace(/^/gm, '    ')}`);
  if (e.warnings) e.warnings.forEach((w) => console.log(`  ${formatWarning(w)}`));
  process.exitCode = 1;
}

async function cmdRender(opts) {
  const src = readDraft(opts._[0]);
  let result;
  try {
    result = renderDraft(src, { cwd: process.cwd(), base: opts.base, allowRun: opts.allowRun, meta: { mode: opts.mode } });
  } catch (e) {
    return printError(e, src);
  }
  const name = `${slug(result.meta.title || 'page')}.html`;
  const out = resolve(opts.out || join(home(), 'pages', name));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, result.html);
  const comps = Object.entries(result.stats.components).map(([k, v]) => (v > 1 ? `${k}×${v}` : k)).join(', ');
  console.log(`✓ ${out}`);
  console.log(`  ${result.stats.panels} sections${comps ? ` · ${comps}` : ''}${result.coverage ? ` · ${result.coverage.covered}/${result.coverage.total} hunks explained` : ''}`);
  if (result.runs.length) {
    const checks = result.runs.flatMap((r) => r.checks);
    const failed = result.runs.filter((r) => r.code !== 0).length;
    console.log(`  ran ${result.runs.length} command${result.runs.length > 1 ? 's' : ''}${failed ? ` (${failed} exited non-zero)` : ''}${checks.length ? ` · checks ${checks.filter((c) => c.ok).length}/${checks.length} passed` : ''}`);
    for (const r of result.runs) for (const c of r.checks) if (!c.ok) console.log(`  ✗ $ ${r.cmd}: expected output that ${c.text}`);
  }
  if (result.warnings.length) {
    console.log(`  ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''} (fix and re-render; max 2 rounds):`);
    result.warnings.slice(0, 25).forEach((w) => console.log(`  ${formatWarning(w)}`));
    if (result.warnings.length > 25) console.log(`  … ${result.warnings.length - 25} more`);
  }
  const inv = numberInventory(src);
  if (inv.length) console.log(`  numbers by unit (check they agree): ${inv.join(' · ')}`);
  if (opts.check) await runCheck(out, opts.shot || out.replace(/\.html$/, '.png'));
  if (shouldOpen(opts)) openFile(out);
}

async function runCheck(file, shot, section) {
  const { checkPage } = await import('./lib/check.mjs');
  const res = await checkPage(file, { shot, section });
  if (res.skipped) return console.log(`  check skipped: ${res.skipped}`);
  if (!res.problems.length) console.log(`  check: no layout problems at 1280px or 390px`);
  else {
    console.log(`  check: ${res.problems.length} layout problem${res.problems.length > 1 ? 's' : ''}:`);
    res.problems.forEach((p) => console.log(`  ${p.level === 'error' ? '✗' : '!'} ${p.where}: ${p.message}`));
    if (res.problems.some((p) => p.level === 'error')) process.exitCode = 1;
  }
  if (res.shot && section) console.log(`  close-up: ${res.shot}`);
  else if (res.shot) console.log(`  screenshots: ${res.shot} (desktop), ${res.shot.replace(/\.png$/, '-phone.png')} (phone) — look at them before you answer`);
  if (res.closeups?.length) console.log(`  figure close-ups (critique each one): ${res.closeups.map((f) => f.split('/').pop()).join(', ')} — same folder`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = parseArgs(rest);
  switch (cmd) {
    case 'render':
      return cmdRender(opts);
    case 'diff': {
      try {
        const diff = loadDiff(process.cwd(), opts.base);
        console.log(formatDiffIndex(diff, { full: !opts.brief, maxLines: opts.maxLines || 80 }));
        if (!diff.hunks.length) console.log('\nNo changes against this base. Pass --base <rev> to pick another.');
      } catch (e) {
        printError(e);
      }
      return;
    }
    case 'check': {
      const file = resolve(opts._[0] || '');
      return runCheck(file, opts.shot || file.replace(/\.html$/, '.png'), opts.section);
    }
    case 'video': {
      const { makeVideo } = await import('./lib/video.mjs');
      const file = resolve(opts._[0] || '');
      const out = resolve(opts.out || file.replace(/\.html$/, '.mp4'));
      const res = await makeVideo(file, { out, voice: opts.voice, log: (m) => console.log(`  ${m}`) });
      console.log(`✓ ${res.out}`);
      console.log(`  ${res.seconds.toFixed(1)} s · ${res.segments} segments · voice: ${res.voice}${res.voice === 'none' ? ' (captions only; set ELEVENLABS_API_KEY for narration)' : ''}`);
      return;
    }
    case 'lint': {
      const src = readDraft(opts._[0]);
      try {
        const r = renderDraft(src, { cwd: process.cwd(), base: opts.base, allowRun: opts.allowRun });
        if (!r.warnings.length) console.log('✓ no warnings');
        r.warnings.forEach((w) => console.log(formatWarning(w)));
      } catch (e) {
        printError(e, src);
      }
      return;
    }
    case 'list':
      for (const c of COMPONENTS.values()) console.log(`${c.name.padEnd(10)} ${c.summary}`);
      return;
    case 'parse':
      console.log(JSON.stringify(parseDraft(readDraft(opts._[0])), null, 2));
      return;
    case 'version':
    case '--version':
      console.log(VERSION);
      return;
    case 'help':
    case '--help':
    case '-h':
    case undefined: {
      const topic = opts._[0];
      if (!topic) return console.log(HELP);
      if (topic === 'format') return console.log(FORMAT);
      if (topic === 'review') return console.log(REVIEW);
      const c = COMPONENTS.get(topic);
      if (!c) {
        console.log(`No help for "${topic}". Topics: format, review, ${[...COMPONENTS.keys()].join(', ')}`);
        process.exitCode = 2;
        return;
      }
      console.log(`${c.name}: ${c.summary}\n\n${c.syntax}\n\nExample:\n${c.example}`);
      return;
    }
    default:
      console.log(`Unknown command "${cmd}".\n\n${HELP}`);
      process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
});
