import { esc, DraftError } from '../util.mjs';
import { inline } from '../md.mjs';

// Make a ratio visible: each row is a grid of cells for the whole, with the part filled.
// A small part next to its whole is felt, not just read.
const CELLS = 200;
const fmt = (v) => Number(v).toLocaleString('en-US');

export default {
  name: 'waffle',
  summary: 'Make one key number visceral: a part of a whole as a grid of cells (3 failures in 1,000 requests).',
  syntax: `\`\`\`waffle [unit=requests]
Served from cache | 997 of 1000 | no database work
Went to the database | 3 of 1000 | cold keys only
\`\`\`
Each row: label | part of whole | optional note. Up to 4 rows, same whole works best.
Each cell stands for whole ÷ ${CELLS}; any non-zero part fills at least one cell, and the caption gives the exact numbers.`,
  example: '```waffle unit=requests\nCache hits | 997 of 1000\nMisses | 3 of 1000\n```',
  render(text, ctx) {
    const unit = (ctx.args.match(/unit=(\S+)/) ?? [])[1] ?? '';
    const rows = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l, k) => {
      const [label, nums, note = ''] = l.split(/\s+\|\s+/);
      const m = (nums ?? '').replace(/[,_]/g, '').match(/^([\d.]+)\s+of\s+([\d.]+)$/i);
      if (!label || !m) throw new DraftError(`Waffle row needs "label | part of whole": ${l}`, { line: k + 1, example: 'Cache hits | 997 of 1000 | note' });
      const [part, whole] = [Number(m[1]), Number(m[2])];
      if (!(whole > 0) || part < 0 || part > whole) throw new DraftError(`Part must be between 0 and the whole: ${l}`, { line: k + 1 });
      return { label, part, whole, note };
    });
    if (!rows.length || rows.length > 4) throw new DraftError('waffle needs 1–4 rows', { line: 1 });
    return `<figure class="waffle">${rows
      .map((r, i) => {
        const filled = r.part === 0 ? 0 : Math.max(1, Math.round((r.part / r.whole) * CELLS));
        const pct = (r.part / r.whole) * 100;
        const pctText = pct >= 1 || pct === 0 ? `${+pct.toFixed(1)}%` : `${+pct.toPrecision(2)}%`;
        const cells = Array.from({ length: CELLS }, (_, j) => `<i${j < filled ? ' class="on"' : ''}></i>`).join('');
        return `<div class="wrow" data-step="${i + 1}"><div class="wlab"><strong>${inline(r.label, ctx)}</strong><span class="wnum">${fmt(r.part)}${unit ? ` ${esc(r.part === 1 ? unit.replace(/s$/, '') : unit)}` : ''} <small>of ${fmt(r.whole)} · ${pctText}</small></span>${r.note ? `<span class="wnote">${inline(r.note, ctx)}</span>` : ''}</div><div class="wgrid" role="img" aria-label="${esc(`${r.label}: ${fmt(r.part)} of ${fmt(r.whole)}`)}">${cells}</div></div>`;
      })
      .join('')}${rows.every((r) => r.whole === rows[0].whole) ? `<figcaption>Each square = ${fmt(+(rows[0].whole / CELLS).toPrecision(3))}${unit ? ` ${esc(unit)}` : ''}.</figcaption>` : ''}</figure>`;
  },
};
