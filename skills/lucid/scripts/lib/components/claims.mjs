import { inline } from '../md.mjs';
import { DraftError } from '../util.mjs';

// A claim ledger: every important statement on the page, with how sure we are and why.
// "verified" must point at evidence the reader can open: a code reference, a hunk, a run block, or a link.
const STATUS = {
  verified: ['✓', 'Verified'],
  inferred: ['~', 'Inferred'],
  unverified: ['?', 'Not verified'],
};
const EVIDENCE = /\[\[[^\]]+\]\]|\bH\d+\b|\bhttps?:\/\/|\brun\b|```/;

export default {
  name: 'claims',
  summary: 'Claim ledger: each key claim marked verified (with evidence), inferred, or not verified.',
  syntax: `\`\`\`claims
verified | Page 1 skips the first 20 rows | [[src/orders.js:8]] and the run block above
inferred | The author meant pages to start at 0 | no test or comment says so
unverified | Traffic is low enough for an in-process cache
\`\`\`
"verified" needs evidence the reader can open: [[path:line]], a hunk id (H3), "run", or a URL.
"inferred" says what the inference rests on. Use "unverified" rather than dropping an honest doubt.`,
  example: '```claims\nverified | The key has no user id | [[src/orders.js:10]]\ninferred | Written for a single-user prototype | no tests cover several users\n```',
  render(text, ctx) {
    const rows = [];
    text.split('\n').forEach((raw, k) => {
      const t = raw.trim();
      if (!t) return;
      const [status, claim, evidence = ''] = t.split(/\s+\|\s+/);
      const s = status.toLowerCase();
      if (!STATUS[s]) throw new DraftError(`Claim status must be verified, inferred or unverified. Got "${status}"`, { line: k + 1 });
      if (!claim) throw new DraftError('A claim line needs "status | claim | evidence"', { line: k + 1 });
      if (s === 'verified' && !EVIDENCE.test(evidence)) {
        throw new DraftError(`"${claim}" is marked verified but names no evidence. Add [[path:line]], a hunk id, "run" or a URL — or mark it inferred`, { line: k + 1 });
      }
      rows.push({ s, claim, evidence });
      ctx.claims[s] = (ctx.claims[s] ?? 0) + 1;
    });
    if (!rows.length) throw new DraftError('claims is empty', { line: 1 });
    return `<div class="claims">${rows
      .map((r) => `<div class="claim c-${r.s}"><span class="cs" title="${STATUS[r.s][1]}">${STATUS[r.s][0]} ${STATUS[r.s][1]}</span><div><p>${inline(r.claim, ctx)}</p>${r.evidence ? `<p class="ev">${inline(r.evidence, ctx)}</p>` : ''}</div></div>`)
      .join('')}</div>`;
  },
};
