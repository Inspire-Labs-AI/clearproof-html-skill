import { esc, DraftError } from '../util.mjs';

// A bespoke figure: hand-built HTML/SVG plus an optional script, for the one or two figures that carry the
// explanation (a simulator, a walk-through with real data, a before/after). lucid supplies the frame, the
// controls kit (L), theme colours, numbering and the checks; the model supplies only the figure's logic.
export default {
  name: 'figure',
  summary: 'Bespoke interactive figure (HTML/SVG + script) for the mechanism itself — a simulator, a walk with real data. Uses the L kit.',
  syntax: `\`\`\`figure caption="Row order: 1 miss per line. Column order: every read misses." [wide]
<div class="cells"></div>                      any HTML / inline SVG; style with the theme classes below
<script>
// fig = this figure's element, L = the kit. Draw the most informative frame first:
// readers (and screenshots) see the initial state before touching anything.
const cells = fig.querySelector('.cells');
const rd = L.readout(fig, 'Misses');
const render = (order, step) => { /* draw state for this step; rd.set(n) */ };
L.toggle(fig, ['Row by row', 'Column by column'], (i) => p.go(0));
const p = L.player(fig, { steps: 16, onStep: (s) => render(0, s), interval: 700 });
</script>
\`\`\`
Kit: L.player(fig, {steps, onStep, interval, labels}) · L.toggle(fig, labels, onChange, initial)
     L.slider(fig, {label, min, max, step, value, format}, onInput) · L.readout(fig, label) → {set}
     L.steps(fig, captions)  — parts marked data-s="k" appear at step k (opens on the full picture)
     L.beforeAfter(fig, ['Before','After'])  — swaps .only-before / .only-after parts of one drawing
     L.el(tag, attrs, ...children) · L.svg(tag, attrs, ...children) · L.color('accent'|'ok'|'risk'|'warn'|'ink'|'ink-3'|'line'|'node')
Theme classes: .cell .cell.on .cell.hit .cell.miss .cell.dim  .tag  .mono  .muted
Rules: real values in the figure (addresses, keys, counts); one idea per figure; label directly; no external
scripts or fonts; keep it under ~120 lines; it must work with no clicks (initial frame) and with the controls.`,
  example: '```figure caption="Each step reads one cell"\n<div class="row"></div>\n<script>\nconst row = fig.querySelector(\'.row\');\nfor (let i = 0; i < 8; i++) row.append(L.el(\'span\', { class: \'cell\' }, String(i)));\nL.player(fig, { steps: 8, onStep: (s) => [...row.children].forEach((c, i) => c.classList.toggle(\'on\', i === s)) });\n</script>\n```',
  render(text, ctx) {
    const m = text.match(/<script>([\s\S]*?)<\/script>/i);
    const html = text.replace(/<script>[\s\S]*?<\/script>/gi, '').trim();
    if (/<script[^>]*\bsrc=/i.test(text)) throw new DraftError('figure scripts must be inline; external scripts are not allowed', { line: 0 });
    if (/https?:\/\/(?!www\.w3\.org)/i.test(text)) throw new DraftError('figure must not load anything from the network', { line: 0 });
    if (!html && !m) throw new DraftError('figure is empty', { line: 1 });
    const id = ctx.uid();
    const script = m ? `<script type="text/plain" class="fig-src">${m[1].replace(/<\/(script)/gi, '<\\/$1')}</script>` : '';
    const wide = /\bwide\b/.test(ctx.args.replace(/caption="[^"]*"/, ''));
    return `<div class="custom-fig${wide ? ' wide' : ''}" id="${esc(id)}" data-fig>${html}${script}</div>`;
  },
};
