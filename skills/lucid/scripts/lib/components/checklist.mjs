import { inline } from '../md.mjs';

// Things the reader must verify. State is kept per page in localStorage.
export default {
  name: 'checklist',
  summary: 'What the reader must verify or do. Ticks persist in the browser.',
  syntax: '```checklist\n- [ ] Token expiry is checked before use [[src/auth.js:42]]\n- [x] Migration is reversible\n```',
  example: '```checklist\n- [ ] Run the migration on staging\n- [ ] Check the p99 dashboard\n```',
  render(text, ctx) {
    const items = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^[-*]?\s*(?:\[( |x|X)\]\s*)?(.+)$/);
      return { done: m[1] && m[1] !== ' ', text: m[2] };
    });
    const id = ctx.uid();
    return `<div class="checklist" data-id="${id}"><p class="progress"><span>0</span> of ${items.length} checked</p><ul>${items
      .map((it, j) => `<li><label><input type="checkbox" data-k="${id}-${j}"${it.done ? ' checked' : ''}> <span>${inline(it.text, ctx)}</span></label></li>`)
      .join('')}</ul></div>`;
  },
};
