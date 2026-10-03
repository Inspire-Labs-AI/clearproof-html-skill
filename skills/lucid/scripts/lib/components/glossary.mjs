import { inline } from '../md.mjs';
import { esc } from '../util.mjs';

// Terms defined once; every use of the term on the page gets a hover definition.
export default {
  name: 'glossary',
  summary: 'Define jargon once; every later use on the page shows the definition on hover.',
  syntax: '```glossary\nISN: Initial sequence number, picked at random per connection\nMSL: Maximum segment lifetime, usually 2 minutes\n```',
  example: '```glossary\nRTT: Round-trip time\n```',
  render(text, ctx) {
    const terms = text.split('\n').filter((l) => l.includes(':')).map((l) => {
      const k = l.indexOf(':');
      return [l.slice(0, k).trim(), l.slice(k + 1).trim()];
    });
    ctx.glossary.push(...terms);
    return `<dl class="glossary">${terms.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${inline(d, ctx)}</dd></div>`).join('')}</dl>`;
  },
};
