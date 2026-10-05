# Contributing to clearproof

Thanks for helping. clearproof has no runtime dependencies; keep it that way.

## Set up

```bash
git clone https://github.com/Inspire-Labs-AI/clearproof-html-skill.git
cd clearproof-html-skill
npm test          # Node.js 20+; no install step
```

`--check` and `video` use Playwright (Chromium) and ffmpeg when they are installed. The tests do not need them.

## Where things live

| Path | What |
|---|---|
| `skills/clearproof/SKILL.md` | The instructions the agent reads. Every line costs tokens in every run: keep it short. |
| `skills/clearproof/scripts/clearproof.mjs` | The CLI: `render`, `diff`, `check`, `video`, `lint`, `list`, `help`. |
| `skills/clearproof/scripts/lib/` | Draft parser, layout engine, components, git diff, lint, browser check, video. |
| `skills/clearproof/scripts/assets/` | Page CSS and the in-browser runtime. |
| `examples/` | Drafts. Each renders with `node skills/clearproof/scripts/clearproof.mjs render <draft> --check`. |
| `docs/` | Example pages, screenshots and the project website. |
| `test/` | `node --test` suite. |

## Pull requests

1. One change per pull request, with a test when behaviour changes.
2. `npm test` passes; changed examples render with `--check` and no layout problems.
3. A new component needs `help` text with a working example, and a line in the SKILL.md table.
4. Rendering a page for `docs/`? Set `CLEARPROOF_LINK='https://github.com/Inspire-Labs-AI/clearproof-html-skill/blob/HEAD/{path}#L{line}'`
   so code references link to GitHub, not to your machine.
5. If a change claims to improve output quality, show it with a before/after page.
