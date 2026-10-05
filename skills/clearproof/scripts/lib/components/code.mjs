import { esc, DraftError } from '../util.mjs';
import { inline } from '../md.mjs';

// Real code from disk, with margin notes. The model writes the notes, never the code.
export function parseNotes(text, { signed = false } = {}) {
  const notes = [];
  text.split('\n').forEach((raw, k) => {
    const t = raw.trim();
    if (!t || t.startsWith('//')) return;
    const m = signed ? t.match(/^([+-]?)(\d+)(?:-(\d+))?\s*:\s*(.+)$/) : t.match(/^()(\d+)(?:-(\d+))?\s*:\s*(.+)$/);
    if (!m) throw new DraftError(`Notes look like "42: text"${signed ? ' (or "+42:" for new lines, "-17:" for removed lines)' : ''}. Got: "${t}"`, { line: k + 1 });
    notes.push({ side: m[1] === '-' ? 'old' : 'new', start: +m[2], end: m[3] ? +m[3] : +m[2], text: m[4], line: k + 1 });
  });
  return notes;
}

export default {
  name: 'code',
  summary: 'Show real lines from a file (read from disk, never retyped) with margin notes.',
  syntax: `\`\`\`code src/auth/session.js:30-58
34: The token is read before the expiry check      note on one line
41-44: This retry loop has no upper bound           note on a range (highlighted)
\`\`\`
Add "side" after the path to put the notes in a column beside the code (best for walking through code line by line).
The path is relative to the repository root. clearproof fails if the file or lines do not exist.
For code that is not in a file (an example you made up), use a normal fence: \`\`\`js`,
  example: '```code src/server.js:10-24\n12: Port comes from the environment\n```',
  render(text, ctx) {
    if (!ctx.args) throw new DraftError('code needs a file reference: ```code path/to/file.js:10-30', { line: 0 });
    const ref = ctx.args.split(/\s+/)[0];
    const r = ctx.repo.resolve(ref, ctx.line);
    let s = r.start ?? 1;
    let e = r.end ?? r.lines.length;
    if (r.start === null && r.lines.length > 80) throw new DraftError(`${r.rel} has ${r.lines.length} lines. Give a range: ${r.rel}:START-END`, { line: 0 });
    if (r.start !== null && r.start === r.end) [s, e] = [Math.max(1, s - 3), Math.min(r.lines.length, e + 3)];
    const notes = parseNotes(text);
    for (const n of notes) {
      if (n.start < s || n.end > e) throw new DraftError(`Note on line ${n.start} is outside the shown range ${s}-${e}`, { line: n.line });
    }
    const hl = (ln) => notes.some((n) => ln >= n.start && ln <= n.end);
    const rows = [];
    if (/\bside\b/.test(ctx.args)) {
      // Code and plain English side by side: each note sits next to the lines it explains.
      const sorted = [...notes].sort((a, b) => a.start - b.start);
      for (let j = 1; j < sorted.length; j++) {
        if (sorted[j].start <= sorted[j - 1].end && sorted[j].start !== sorted[j - 1].start) throw new DraftError(`Side notes ${sorted[j - 1].start}-${sorted[j - 1].end} and ${sorted[j].start}-${sorted[j].end} overlap; side mode needs separate ranges`, { line: sorted[j].line });
      }
      for (let ln = s; ln <= e; ln++) {
        const starts = notes.filter((n) => n.start === ln);
        const covered = notes.some((n) => ln > n.start && ln <= n.end);
        const note = starts.length
          ? `<td class="side" rowspan="${Math.max(...starts.map((n) => n.end - n.start + 1))}"><div class="cnote">${starts.map((n) => inline(n.text, ctx)).join('<br>')}</div></td>`
          : covered ? '' : '<td class="side"></td>';
        rows.push(`<tr class="${hl(ln) ? 'hl' : ''}"><td class="ln">${ln}</td><td class="src">${esc(r.lines[ln - 1]) || ' '}</td>${note}</tr>`);
      }
      return `<figure class="code sbs"><figcaption><a class="ref" href="${esc(ctx.repo.href(r.abs, r.rel, s))}">${esc(r.rel)}</a> <span>lines ${s}–${e}</span></figcaption><div class="scroll"><table>${rows.join('')}</table></div></figure>`;
    }
    for (let ln = s; ln <= e; ln++) {
      rows.push(`<tr class="${hl(ln) ? 'hl' : ''}"><td class="ln">${ln}</td><td class="src">${esc(r.lines[ln - 1]) || ' '}</td></tr>`);
      for (const n of notes.filter((x) => x.end === ln)) rows.push(`<tr class="note-row"><td></td><td><div class="cnote">${inline(n.text, ctx)}</div></td></tr>`);
    }
    return `<figure class="code"><figcaption><a class="ref" href="${esc(ctx.repo.href(r.abs, r.rel, s))}">${esc(r.rel)}</a> <span>lines ${s}–${e}</span></figcaption><div class="scroll"><table>${rows.join('')}</table></div></figure>`;
  },
};
