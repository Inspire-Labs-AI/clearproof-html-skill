import { md } from '../md.mjs';
import { esc, DraftError } from '../util.mjs';

const KINDS = { info: 'ℹ', tip: '★', ok: '✓', warn: '!', risk: '⚠', key: '→' };

export default {
  name: 'callout',
  summary: 'A conclusion, tip, warning or risk that must not be missed.',
  syntax: `\`\`\`callout <info|tip|ok|warn|risk|key> Optional title
Markdown body.
\`\`\``,
  example: '```callout key The answer\nUse Redis: you need persistence and pub/sub.\n```',
  render(text, ctx) {
    const [kind = 'info', ...title] = ctx.args.split(/\s+/).filter(Boolean);
    if (!KINDS[kind]) throw new DraftError(`Unknown callout kind "${kind}". Use: ${Object.keys(KINDS).join(' | ')}`, { line: 0 });
    return `<aside class="callout c-${kind}"><b class="ci" aria-hidden="true">${KINDS[kind]}</b><div>${title.length ? `<strong>${esc(title.join(' '))}</strong>` : ''}${md(text, ctx)}</div></aside>`;
  },
};
