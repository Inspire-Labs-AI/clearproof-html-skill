import { esc, textWidth, wrap, DraftError } from '../util.mjs';
import { player } from './player.mjs';

// Messages between parties over time. Each message is one playback step.
export function parseSequence(text) {
  const parts = [];
  const rows = [];
  const add = (p) => {
    p = p.trim();
    if (!parts.includes(p)) parts.push(p);
    return p;
  };
  let step = 0;
  text.split('\n').forEach((raw, k) => {
    const line = k + 1;
    const t = raw.trim();
    if (!t || t.startsWith('//')) return;
    let m;
    if ((m = t.match(/^participants?\s*:\s*(.+)$/i))) return m[1].split(',').forEach(add);
    if ((m = t.match(/^==\s*(.+?)\s*==$/))) return rows.push({ type: 'phase', text: m[1], line });
    if ((m = t.match(/^note\s+(.+?)\s*:\s*(.+)$/i))) {
      const who = m[1].split(',').map(add);
      return rows.push({ type: 'note', who, text: m[2], line, step: Math.max(step, 0) });
    }
    if ((m = t.match(/^(.+?)\s*(-->|->|-x)\s*(.+?)\s*:\s*(.*)$/))) {
      let label = m[4];
      let note = '';
      const bar = label.lastIndexOf(' | ');
      if (bar >= 0) [label, note] = [label.slice(0, bar), label.slice(bar + 3)];
      step++;
      return rows.push({ type: 'msg', from: add(m[1]), to: add(m[3]), kind: m[2], label: label.trim(), note: note.trim(), step, line });
    }
    throw new DraftError(`Cannot read this sequence line: "${t}"`, { line });
  });
  if (!rows.some((r) => r.type === 'msg')) throw new DraftError('sequence needs at least one message: A -> B: text', { line: 1 });
  return { parts, rows, steps: step };
}

export default {
  name: 'sequence',
  summary: 'Messages between parties over time: protocols, request lifecycles, handshakes. Step-through playback.',
  syntax: `\`\`\`sequence [static]
participants: Client, API, DB       optional; fixes the column order
Client -> API: POST /login          request (solid)
API --> Client: 200 OK              reply (dashed)
API -x DB: query                    failed / dropped message
Client -> API: SYN | caption        text after " | " is the caption at this step
note API: checks the token          note over one party
note Client, API: TLS from here     note across parties
== Phase two ==                     divider
\`\`\``,
  example: '```sequence\nClient -> Server: SYN\nServer --> Client: SYN+ACK\nClient -> Server: ACK | Both sides are now ESTABLISHED\n```',
  render(text, ctx) {
    const { parts, rows, steps } = parseSequence(text);
    const id = ctx.uid();
    const F = 13;
    const colW = Math.max(130, ...parts.map((p) => textWidth(p, F) + 36));
    // Column gap must fit the widest label between adjacent parties.
    const gaps = new Array(Math.max(0, parts.length - 1)).fill(colW);
    for (const r of rows) {
      if (r.type !== 'msg' || r.from === r.to) continue;
      const a = parts.indexOf(r.from);
      const b = parts.indexOf(r.to);
      const span = Math.abs(a - b);
      const need = Math.min(textWidth(r.label, 12), 300) + 40;
      const lo = Math.min(a, b);
      const have = gaps.slice(lo, lo + span).reduce((s, g) => s + g, 0);
      if (have < need) for (let j = lo; j < lo + span; j++) gaps[j] += (need - have) / span;
    }
    const X = [colW / 2];
    gaps.forEach((g, j) => X.push(X[j] + g));
    const width = X[X.length - 1] + colW / 2;
    const head = 40;
    let y = head + 26;
    const body = [];
    for (const r of rows) {
      if (r.type === 'phase') {
        body.push(`<g class="phase" data-step="${r.step ?? 0}"><line x1="4" x2="${width - 4}" y1="${y + 8}" y2="${y + 8}"/><text x="${width / 2}" y="${y + 12}">${esc(r.text)}</text></g>`);
        y += 30;
      } else if (r.type === 'note') {
        const xs = r.who.map((w) => X[parts.indexOf(w)]);
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        const bw = Math.max(hi - lo + 90, Math.min(textWidth(r.text, 12) + 24, 320));
        const lines = wrap(r.text, bw - 20, 12);
        const h = lines.length * 15 + 12;
        const cx = (lo + hi) / 2;
        body.push(`<g class="note" data-step="${r.step}"><rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="4"/><text x="${cx}" y="${y + 18}">${lines
          .map((l, j) => `<tspan x="${cx}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`)
          .join('')}</text></g>`);
        y += h + 14;
      } else {
        const x1 = X[parts.indexOf(r.from)];
        const x2 = X[parts.indexOf(r.to)];
        const lines = wrap(r.label, x1 === x2 ? 220 : Math.max(Math.abs(x2 - x1) - 28, 80), 12);
        const ty = y + lines.length * 15 - 4;
        const cls = `msg${r.kind === '-->' ? ' dashed' : ''}${r.kind === '-x' ? ' lost' : ''}`;
        const note = r.note || `${r.from} → ${r.to}: ${r.label}`;
        let shape;
        let lx = (x1 + x2) / 2;
        if (x1 === x2) {
          shape = `<path d="M${x1},${ty + 6} h36 v18 h-34" marker-end="url(#${id}a)"/>`;
          lx = x1 + 44;
          y += 18;
        } else shape = `<line x1="${x1}" y1="${ty + 6}" x2="${x2 + (x2 > x1 ? -2 : 2)}" y2="${ty + 6}" marker-end="url(#${id}a)"/>`;
        const anchor = x1 === x2 ? ' text-anchor="start"' : '';
        body.push(`<g class="${cls}" data-step="${r.step}" data-note="${esc(note)}">${shape}<text x="${lx}" y="${y + 8}"${anchor}>${lines
          .map((l, j) => `<tspan x="${lx}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`)
          .join('')}</text><text class="num" x="${Math.min(x1, x2) + (x1 === x2 ? -14 : 8)}" y="${ty + 2}">${r.step}</text></g>`);
        y += lines.length * 15 + 22;
      }
    }
    const H = y + 10;
    const heads = parts
      .map((p, j) => `<g class="actor"><line x1="${X[j]}" y1="${head}" x2="${X[j]}" y2="${H - 6}"/><rect x="${X[j] - (colW - 24) / 2}" y="4" width="${colW - 24}" height="${head - 8}" rx="6"/><text x="${X[j]}" y="${head / 2 + 5}">${esc(p)}</text></g>`)
      .join('');
    const playable = !ctx.args.split(/\s+/).includes('static');
    const svg = `<svg class="seq" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(H)}" style="max-width:${Math.ceil(width)}px" role="img" aria-label="Sequence diagram"><defs><marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="arrowhead"/></marker></defs>${heads}${body.join('')}</svg>`;
    return `<figure class="diagram${playable ? ' playable' : ''}" data-steps="${steps}">${svg}${playable && steps > 1 ? player(steps) : ''}</figure>`;
  },
};
