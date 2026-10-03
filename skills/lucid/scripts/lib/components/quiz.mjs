import { inline, md } from '../md.mjs';
import { esc, DraftError } from '../util.mjs';

// Check-yourself questions. Understanding is tested, not assumed.
export default {
  name: 'quiz',
  summary: 'Check-yourself questions with instant feedback. Ends an explanation or a review.',
  syntax: `\`\`\`quiz
? Why does TCP need a third message?          a question
- [ ] To send data
- [x] So the server knows the client can receive   [x] marks the right answer(s)
> The SYN+ACK proves only the server's path.  explanation shown after answering

? What happens to a late duplicate SYN?       open question (no options)
= The client rejects it with RST.             answer revealed on click
\`\`\``,
  example: '```quiz\n? Which call can block?\n- [ ] read_cache()\n- [x] fetch_user()\n> It waits on the network.\n```',
  render(text, ctx) {
    const qs = [];
    let q = null;
    text.split('\n').forEach((raw, k) => {
      const t = raw.trim();
      if (!t) return;
      let m;
      if ((m = t.match(/^\?\s*(.+)$/))) qs.push((q = { q: m[1], opts: [], why: [], answer: '' }));
      else if (!q) throw new DraftError('Start each question with "? "', { line: k + 1 });
      else if ((m = t.match(/^[-*]\s*\[( |x|X)\]\s*(.+)$/))) q.opts.push({ text: m[2], ok: m[1] !== ' ' });
      else if ((m = t.match(/^>\s?(.*)$/))) q.why.push(m[1]);
      else if ((m = t.match(/^=\s*(.+)$/))) q.answer = m[1];
      else throw new DraftError(`Cannot read quiz line: "${t}"`, { line: k + 1 });
    });
    if (!qs.length) throw new DraftError('quiz has no questions', { line: 1 });
    for (const x of qs) if (x.opts.length && !x.opts.some((o) => o.ok)) throw new DraftError(`Question "${x.q}" has no [x] answer`, { line: 1 });
    return `<div class="quiz">${qs
      .map((x, i) => {
        const why = x.why.length ? `<div class="why" hidden>${md(x.why.join('\n'), ctx)}</div>` : '';
        if (!x.opts.length) return `<div class="q open"><p class="qq"><b>Q${i + 1}.</b> ${inline(x.q, ctx)}</p><button type="button" class="reveal">Show answer</button><div class="ans" hidden>${inline(x.answer, ctx)}</div>${why}</div>`;
        const multi = x.opts.filter((o) => o.ok).length > 1;
        return `<div class="q" data-multi="${multi}"><p class="qq"><b>Q${i + 1}.</b> ${inline(x.q, ctx)}${multi ? ' <small>(pick all that apply)</small>' : ''}</p><div class="opts">${x.opts
          .map((o) => `<button type="button" class="opt" data-ok="${o.ok}">${inline(o.text, ctx)}</button>`)
          .join('')}</div>${why}</div>`;
      })
      .join('')}<p class="score" aria-live="polite"></p></div>`;
  },
};
