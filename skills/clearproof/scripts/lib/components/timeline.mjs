import { inline } from '../md.mjs';
import { DraftError } from '../util.mjs';

export default {
  name: 'timeline',
  summary: 'History, releases, phases, incident timelines.',
  syntax: `\`\`\`timeline
2014 | Borg paper | Google describes its cluster manager
*2015 | Kubernetes 1.0 | first stable release      * highlights a moment
\`\`\``,
  example: '```timeline\n2014 | Announced\n*2015 | 1.0 | First stable release\n```',
  render(text, ctx) {
    const items = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).map((l) => {
      let [when, title = '', ...desc] = l.trim().split(' | ');
      const hot = when.startsWith('*');
      if (hot) when = when.slice(1).trim();
      return { when, title, desc: desc.join(' | '), hot };
    });
    if (!items.length) throw new DraftError('timeline is empty', { line: 1 });
    return `<ol class="timeline">${items
      .map((it, j) => `<li class="${it.hot ? 'hot' : ''}" data-step="${j + 1}"><time>${inline(it.when, ctx)}</time><div><strong>${inline(it.title, ctx)}</strong>${it.desc ? `<p>${inline(it.desc, ctx)}</p>` : ''}</div></li>`)
      .join('')}</ol>`;
  },
};
