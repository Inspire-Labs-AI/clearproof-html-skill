import { inline } from '../md.mjs';
import { DraftError } from '../util.mjs';

const ORDER = { high: 0, med: 1, low: 2 };

export default {
  name: 'risks',
  summary: 'Ranked risks: what could break, where, and how bad.',
  syntax: `\`\`\`risks
high | src/auth.js:42 | Expired tokens are accepted for one request     level | where | what
med | H4 | Retry has no upper bound                                  "where" can be a hunk id
low | Log line includes the user id                                   or omitted
\`\`\``,
  example: '```risks\nhigh | src/db.js:30 | No transaction around the two writes\n```',
  render(text, ctx) {
    const items = text.split('\n').map((l) => l.trim()).filter(Boolean).map((l, k) => {
      const parts = l.split(/\s+\|\s+/);
      const level = parts[0].toLowerCase().replace('medium', 'med');
      if (!(level in ORDER)) throw new DraftError(`Risk level must be high, med or low. Got "${parts[0]}"`, { line: k + 1 });
      const [where, what] = parts.length >= 3 ? [parts[1], parts.slice(2).join(' | ')] : [null, parts[1] ?? ''];
      return { level, where, what };
    });
    items.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
    return `<ul class="risks">${items
      .map((r) => `<li class="r-${r.level}"><span class="lvl">${r.level}</span><div>${inline(r.what, ctx)}${r.where ? ` <span class="where">${inline(`[[${r.where}]]`, ctx)}</span>` : ''}</div></li>`)
      .join('')}</ul>`;
  },
};
