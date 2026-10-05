import { esc, textWidth, DraftError } from '../util.mjs';

// Small honest charts: bars start at zero, values are labelled directly, at most 4 series.
const fmt = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(+v.toFixed(2)));

export function parseChart(text) {
  let series = null;
  const rows = [];
  text.split('\n').forEach((raw, k) => {
    const t = raw.trim();
    if (!t || t.startsWith('//')) return;
    const s = t.match(/^series\s*:\s*(.+)$/i);
    if (s) return void (series = s[1].split(',').map((x) => x.trim()));
    let [label, vals] = t.split(/\s+\|\s+/);
    if (vals === undefined) throw new DraftError(`Chart row needs "label | value": ${t}`, { line: k + 1 });
    // "*label" highlights the row; "value ! note" writes a note beside the bar.
    let note = '';
    const bang = vals.indexOf(' ! ');
    if (bang >= 0) [vals, note] = [vals.slice(0, bang), vals.slice(bang + 3).trim()];
    const hot = label.trim().startsWith('*');
    if (hot) label = label.trim().slice(1);
    const values = vals.split(/,\s+|,(?=\s*-?\d)/).map((v) => Number(v.trim().replace(/[_]/g, '')));
    if (values.some((v) => !Number.isFinite(v))) throw new DraftError(`Not a number in: ${t}`, { line: k + 1 });
    rows.push({ label: label.trim(), values, hot, note });
  });
  if (!rows.length) throw new DraftError('chart has no rows', { line: 1 });
  const n = Math.max(...rows.map((r) => r.values.length));
  if (n > 4) throw new DraftError('Use at most 4 series in one chart', { line: 1 });
  series ??= n > 1 ? Array.from({ length: n }, (_, j) => `Series ${j + 1}`) : [''];
  return { series, rows };
}

export default {
  name: 'chart',
  summary: 'Numbers: compare quantities (bar), show change over time (line).',
  syntax: `\`\`\`chart <bar|line> [unit=ms] [title="p99 latency"] [scale=log]
series: before, after          optional, for 2-4 series
Redis | 0.4, 0.3               label | value[, value...]
Postgres | 2.1, 1.2
*DRAM | 300 ! ≈80 ns, 75× L1    * highlights one bar (others turn grey); " ! " writes a note beside it
\`\`\`
Use real numbers only. Say "illustrative" in the panel if they are not measured.
scale=log for values that span orders of magnitude (1 vs 1,000,000). If the numbers come from a run block on the page,
copy them exactly: lucid warns when a chart value does not appear in any run output.`,
  example: '```chart bar unit=ms\nRedis | 0.4\nPostgres | 2.1\n```',
  render(text, ctx) {
    const { series, rows } = parseChart(text);
    ctx.chartValues?.push(...rows.flatMap((r) => r.values.map((v) => ({ v, line: ctx.line }))));
    const log = /\bscale=log\b/.test(ctx.args);
    if (log && rows.some((r) => r.values.some((v) => v <= 0))) throw new DraftError('scale=log needs values above 0', { line: 0 });
    const opts = Object.fromEntries([...ctx.args.matchAll(/(\w+)=(?:"([^"]*)"|(\S+))/g)].map((m) => [m[1], m[2] ?? m[3]]));
    const type = ctx.args.split(/\s+/)[0] || 'bar';
    if (!['bar', 'line'].includes(type)) throw new DraftError(`Unknown chart type "${type}". Use bar or line`, { line: 0 });
    const unit = opts.unit ? ` ${opts.unit}` : '';
    const max = Math.max(...rows.flatMap((r) => r.values), 0) || 1;
    const min = Math.min(0, ...rows.flatMap((r) => r.values));
    const legend = series.length > 1 ? `<div class="legend">${series.map((s, j) => `<span><i class="sw s${j}"></i>${esc(s)}</span>`).join('')}</div>` : '';
    const title = opts.title ? `<figcaption>${esc(opts.title)}</figcaption>` : '';
    if (type === 'bar') {
      const anyHot = rows.some((r) => r.hot);
      const lw = Math.min(160, Math.max(...rows.map((r) => textWidth(r.label, 13))) + 12);
      const barH = 18;
      const rowH = series.length * (barH + 3) + 12;
      const noteSpace = Math.min(240, Math.max(0, ...rows.map((r) => (r.note ? textWidth(r.note, 12) + 16 : 0))));
      const plot = 440 - lw - 80;
      const W = 440 + noteSpace;
      const H = rows.length * rowH + 4;
      const lmin = log ? Math.floor(Math.log10(Math.min(...rows.flatMap((r) => r.values)))) : 0;
      const lmax = log ? Math.ceil(Math.log10(max)) || 1 : 0;
      const scale = log ? (v) => ((Math.log10(Math.max(v, 10 ** lmin)) - lmin) / (lmax - lmin || 1)) * plot : (v) => ((v - min) / (max - min)) * plot;
      const body = rows.map((r, i) => {
        const y = i * rowH + 6;
        const bars = r.values.map((v, j) => {
          const by = y + j * (barH + 3);
          const x0 = log ? lw : lw + scale(Math.min(0, v));
          const w = Math.max(1, log ? scale(v) : Math.abs(scale(v) - scale(0)));
          const cls = anyHot && series.length === 1 ? (r.hot ? 's0' : 'muted') : `s${j}`;
          const valText = `${fmt(v)}${esc(v === 1 ? unit.replace(/s$/, '') : unit)}`;
          const note = r.note && j === r.values.length - 1 ? `<tspan class="anno" dx="10">${esc(r.note)}</tspan>` : '';
          return `<rect class="${cls}" x="${x0.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${barH}" rx="3"/><text class="val${r.hot ? ' hot' : ''}" x="${(x0 + w + 6).toFixed(1)}" y="${by + 13}">${valText}${note}</text>`;
        });
        return `<g data-step="${i + 1}"><text class="lab" x="${lw - 8}" y="${y + (series.length * (barH + 3)) / 2 + 3}">${esc(r.label)}</text>${bars.join('')}</g>`;
      });
      const axisX = log ? lw : lw + scale(0);
      const note = log ? `<p class="chart-note">Log scale: each step to the right is ×10.</p>` : '';
      return `<figure class="chart">${title}${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || 'Bar chart')}"><line class="axis" x1="${axisX}" x2="${axisX}" y1="0" y2="${H}"/>${body.join('')}</svg>${note}</figure>`;
    }
    const W = 440;
    const H = 220;
    const L = 48;
    const B = 28;
    const plotW = W - L - 60;
    const plotH = H - B - 14;
    const x = (i) => L + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
    const lo = log ? Math.floor(Math.log10(Math.min(...rows.flatMap((r) => r.values)))) : 0;
    const hi = log ? Math.ceil(Math.log10(max)) || 1 : 0;
    const y = log ? (v) => 10 + plotH - ((Math.log10(v) - lo) / (hi - lo || 1)) * plotH : (v) => 10 + plotH - ((v - min) / (max - min)) * plotH;
    const tickVals = log ? Array.from({ length: hi - lo + 1 }, (_, k) => 10 ** (lo + k)) : [min, (min + max) / 2, max];
    const ticks = tickVals.map((v) => `<line class="grid" x1="${L}" x2="${W - 60}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 4}">${fmt(v)}</text>`);
    const every = Math.ceil(rows.length / 8);
    const xl = rows.map((r, i) => (i % every ? '' : `<text class="xt" x="${x(i)}" y="${H - 8}">${esc(r.label)}</text>`));
    const lines = series.map((s, j) => {
      const pts = rows.map((r, i) => (r.values[j] === undefined ? null : [x(i), y(r.values[j])])).filter(Boolean);
      const last = pts[pts.length - 1];
      const lastV = rows[rows.length - 1].values[j];
      return `<path class="ln s${j}" d="M${pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L')}"/>${pts.map((p) => `<circle class="s${j}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join('')}<text class="val" x="${last[0] + 8}" y="${last[1] + 4}">${lastV === undefined ? '' : fmt(lastV) + esc(unit)}</text>`;
    });
    return `<figure class="chart">${title}${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title || 'Line chart')}">${ticks.join('')}${xl.join('')}${lines.join('')}</svg></figure>`;
  },
};
