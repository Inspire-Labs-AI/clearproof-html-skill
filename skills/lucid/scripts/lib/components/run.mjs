import { spawnSync } from 'node:child_process';
import { esc, DraftError } from '../util.mjs';
import { inline } from '../md.mjs';

// Proof, not prose: lucid runs the command while rendering and embeds the real output.
// The model never types the output, so it cannot be invented. Needs --allow-run.
const MAX_LINES = 40;

export function parseRun(text) {
  const steps = [];
  let cur = null;
  text.split('\n').forEach((raw, k) => {
    const t = raw.trim();
    if (!t) return;
    let m;
    if ((m = t.match(/^\$\s+(.+)$/))) steps.push((cur = { cmd: m[1], expect: [], absent: [], shows: [], note: '', line: k + 1 }));
    else if (!cur) throw new DraftError('Start each command with "$ "', { line: k + 1, example: '$ npm test -- auth\nexpect: 3 passing' });
    else if ((m = t.match(/^expect:\s*(.+)$/i))) cur.expect.push(m[1]);
    else if ((m = t.match(/^absent:\s*(.+)$/i))) cur.absent.push(m[1]);
    else if ((m = t.match(/^shows:\s*(.+)$/i))) cur.shows.push(m[1]);
    else if ((m = t.match(/^note:\s*(.+)$/i))) cur.note = m[1];
    else throw new DraftError(`Cannot read run line: "${t}". Use "$ command", "shows: text", "expect: text", "absent: text" or "note: text"`, { line: k + 1 });
  });
  if (!steps.length) throw new DraftError('run needs at least one "$ command" line', { line: 1 });
  return steps;
}

// Machine-specific paths are noise to a reader: show the repo as "." and temp/home dirs as short names.
export function tidyPaths(text, root) {
  let t = String(text);
  if (root) t = t.split(root + '/').join('./').split(root).join('.');
  return t
    .replace(/\/tmp\/[^\s'"`]*\/([^\s/'"`]+)/g, '$TMP/$1')
    .replace(new RegExp(`${(process.env.HOME || '/root').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=/)`, 'g'), '~');
}

function clip(out) {
  const lines = out.replace(/\s+$/, '').split('\n');
  if (lines.length <= MAX_LINES) return lines.join('\n');
  const head = lines.slice(0, 24);
  const tail = lines.slice(-12);
  return [...head, `… ${lines.length - 36} lines cut …`, ...tail].join('\n');
}

export default {
  name: 'run',
  summary: 'Proof: run a command at render time and embed its real output, exit code and checks (needs --allow-run).',
  syntax: `\`\`\`run [timeout=20]
$ node -e "import('./src/orders.js').then(m => console.log(m.offset(1)))"     command, run from the repository root
shows: 20                    evidence: the output shows this behaviour (use it to prove a bug)
expect: 0                    assertion: correct behaviour must produce this (✓ / ✗ on the page)
absent: Error                assertion: the output must not contain this
note: Page 1 should start at row 0.                 one-line caption
\`\`\`
Call the real code (import the module, run the test) rather than copying a line into eval; if that is impossible, say why in note:.
Use it for: reproducing a bug (shows:), showing a test failing or passing, real tool output (dig, curl -I, git log).
Render with --allow-run. Keep commands fast, local and read-only.`,
  example: '```run\n$ git log --oneline -3\nnote: The last three commits\n```',
  render(text, ctx) {
    const steps = parseRun(text);
    if (!ctx.allowRun) throw new DraftError('This draft has a run block. Render with --allow-run to execute it (commands run from the repository root)', { line: 0, component: 'run' });
    const timeout = Math.min(120, Number((ctx.args.match(/timeout=(\d+)/) ?? [])[1]) || 20) * 1000;
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const flag = process.platform === 'win32' ? '/c' : '-c';
    const blocks = steps.map((s) => {
      const t0 = Date.now();
      const r = spawnSync(shell, [flag, s.cmd], { cwd: ctx.repo.root, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' } });
      const ms = Date.now() - t0;
      const out = `${r.stdout ?? ''}${r.stderr ? (r.stdout ? '\n' : '') + r.stderr : ''}`.replace(/\x1b\[[0-9;]*m/g, '');
      const timedOut = r.error?.code === 'ETIMEDOUT';
      const code = timedOut ? 'timeout' : r.status ?? 'signal';
      // shows: evidence of behaviour (e.g. the bug); expect/absent: assertions of correct behaviour.
      const checks = [
        ...s.shows.map((e) => ({ ok: out.includes(e), kind: 'shows', text: out.includes(e) ? `output shows “${e}”` : `output does not show “${e}”` })),
        ...s.expect.map((e) => ({ ok: out.includes(e), kind: 'expect', text: out.includes(e) ? `as expected: “${e}”` : `expected “${e}” — not in the output` })),
        ...s.absent.map((e) => ({ ok: !out.includes(e), kind: 'absent', text: !out.includes(e) ? `as expected: no “${e}”` : `“${e}” appears in the output` })),
      ];
      ctx.runs.push({ cmd: s.cmd, code, checks, out });
      const badge = checks.length
        ? checks.map((c) => `<span class="chk ${c.kind} ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${esc(c.text)}</span>`).join('')
        : '';
      return `<div class="run-step"><div class="run-head"><code class="cmd">$ ${esc(tidyPaths(s.cmd, ctx.repo.root))}</code><span class="exit ${code === 0 ? 'ok' : 'no'}">exit ${esc(code)}</span><span class="ms">${ms} ms</span></div>${s.note ? `<p class="run-note">${inline(s.note, ctx)}</p>` : ''}<pre class="out">${esc(clip(tidyPaths(out, ctx.repo.root))) || '<i>(no output)</i>'}</pre>${badge ? `<div class="checks">${badge}</div>` : ''}</div>`;
    });
    return `<figure class="run"><figcaption>Ran while this page was made · real output</figcaption>${blocks.join('')}</figure>`;
  },
};
