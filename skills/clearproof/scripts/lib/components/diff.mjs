import { esc, DraftError } from '../util.mjs';
import { inline } from '../md.mjs';
import { parseNotes } from './code.mjs';

// Pick hunks: "H3", "H2,H5", "H2-H4", "src/file.js", "all".
export function selectHunks(diff, spec, line = 0) {
  const out = [];
  const add = (h) => !out.includes(h) && out.push(h);
  for (const part of spec.split(/\s*,\s*/).filter(Boolean)) {
    let m;
    if (part === 'all') diff.hunks.forEach(add);
    else if ((m = part.match(/^H(\d+)-H?(\d+)$/i))) {
      for (let k = +m[1]; k <= +m[2]; k++) {
        const h = diff.hunks.find((x) => x.id === `H${k}`);
        if (!h) throw new DraftError(`There is no hunk H${k}. This diff has H1-H${diff.hunks.length}. Run "clearproof diff" to see them`, { line, component: 'diff' });
        add(h);
      }
    } else if (/^H\d+$/i.test(part)) {
      const h = diff.hunks.find((x) => x.id === part.toUpperCase());
      if (!h) throw new DraftError(`There is no hunk ${part}. This diff has H1-H${diff.hunks.length}. Run "clearproof diff" to see them`, { line, component: 'diff' });
      add(h);
    } else {
      const f = diff.files.find((x) => x.path === part) ?? diff.files.filter((x) => x.path.endsWith(`/${part}`)).at(0);
      if (!f) throw new DraftError(`"${part}" is not a changed file. Changed files: ${diff.files.map((x) => x.path).join(', ')}`, { line, component: 'diff' });
      f.hunks.forEach(add);
    }
  }
  return out;
}

export function hunkTable(h, notes = [], { fold = 6 } = {}) {
  const rows = [];
  const lines = h.lines;
  for (let i = 0; i < lines.length; i++) {
    // Fold long runs of unchanged context.
    if (lines[i].t === ' ') {
      let j = i;
      while (j < lines.length && lines[j].t === ' ') j++;
      const run = j - i;
      if (run > fold * 2 && i > 0 && j < lines.length) {
        for (let k = i; k < i + fold; k++) rows.push(row(lines[k]));
        rows.push(`<tr class="fold"><td colspan="3">⋯ ${run - fold * 2} unchanged lines</td></tr>`);
        for (let k = j - fold; k < j; k++) rows.push(row(lines[k]));
        i = j - 1;
        continue;
      }
    }
    rows.push(row(lines[i]));
  }
  function row(l) {
    const mine = notes.filter((n) => (n.side === 'new' ? l.new !== undefined && l.t !== '-' && n.end === l.new : l.t === '-' && n.end === l.old));
    const hl = notes.some((n) => (n.side === 'new' ? l.t !== '-' && l.new >= n.start && l.new <= n.end : l.t === '-' && l.old >= n.start && l.old <= n.end));
    const cls = l.t === '+' ? 'add' : l.t === '-' ? 'del' : 'ctx';
    let html = `<tr class="${cls}${hl ? ' hl' : ''}"><td class="ln">${l.old ?? ''}</td><td class="ln">${l.t === '-' ? '' : l.new ?? ''}</td><td class="src"><span class="sg">${l.t === ' ' ? ' ' : l.t}</span>${esc(l.text) || ' '}</td></tr>`;
    for (const n of mine) html += `<tr class="note-row"><td colspan="2"></td><td><div class="cnote">${n.html}</div></td></tr>`;
    return html;
  }
  return rows.join('');
}

export default {
  name: 'diff',
  summary: 'Review mode. Show real hunks from the git diff (by id or file) with notes on changed lines.',
  syntax: `\`\`\`diff H3,H4              hunk ids from "clearproof diff"; also H2-H5, a file path, or all
+42: Expiry is now checked before the token is used     note on an added or unchanged line (new-file numbering)
-17: The old code trusted the cache blindly              note on a removed line (old-file numbering)
\`\`\`
Every hunk you show counts as explained. Hunks never shown are reported as not covered.`,
  example: '```diff H2\n+14: Returns early when the user is missing\n```',
  render(text, ctx) {
    const diff = ctx.diff();
    const spec = ctx.args.split(/\s+/)[0];
    if (!spec) throw new DraftError('diff needs hunk ids or a file: ```diff H1,H2', { line: 0 });
    const hunks = selectHunks(diff, spec, ctx.line);
    const notes = parseNotes(text, { signed: true }).map((n) => ({ ...n, html: inline(n.text, ctx) }));
    for (const n of notes) {
      const hit = hunks.some((h) => h.lines.some((l) => (n.side === 'new' ? l.t !== '-' && l.new === n.end : l.t === '-' && l.old === n.end)));
      if (!hit) throw new DraftError(`Note "${n.side === 'new' ? '+' : '-'}${n.end}" does not match a ${n.side === 'new' ? 'new' : 'removed'} line in ${hunks.map((h) => h.id).join(', ')}`, { line: n.line, component: 'diff' });
    }
    hunks.forEach((h) => ctx.covered.add(h.id));
    return hunks
      .map((h) => {
        const f = diff.files.find((x) => x.path === h.file);
        const mine = notes.filter((n) => h.lines.some((l) => (n.side === 'new' ? l.t !== '-' && l.new === n.end : l.t === '-' && l.old === n.end)));
        return `<figure class="code diff" id="${h.id}-${ctx.uid()}"><figcaption><span class="hid">${h.id}</span> ${ctx.repo ? `<a class="ref" href="${esc(ctx.repo.href(`${diff.root}/${h.file}`, h.file, h.newStart))}">${esc(h.file)}</a>` : esc(h.file)} <span class="stat"><b class="a">+${h.add}</b> <b class="d">−${h.del}</b></span>${h.header ? ` <code>${esc(h.header.trim())}</code>` : ''}${f?.status === 'A' ? ' <span class="tag">new file</span>' : ''}</figcaption><div class="scroll"><table>${hunkTable(h, mine)}</table></div></figure>`;
      })
      .join('');
  },
};
