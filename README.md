# lucid

**An agent skill that makes AI output understandable — answers *and* code changes.**

Ask a hard question and get a page with diagrams you can step through, not a wall of text. Ask "what did you change?"
and get a review that leads with the verdict, walks the real diff in the order the data flows, and proves it covered
every hunk. Need it narrated? It exports a video.

```
> Explain how TCP opens and closes a connection
> An agent wrote this branch. Help me understand it — is it safe to merge?
> Walk me through how auth works in this repo
```

| Explain | Review |
|---|---|
| ![TCP explainer](docs/images/explain-tcp.png) | ![Review of an AI-written change](docs/images/review-token-refresh.png) |

## Why

Two observations, one tool:

- **Andrej Karpathy:** we will spend more and more time *understanding* model output. Move it up a ladder — controlled
  plain English (ASD-STE100), then diagrams, then interactive HTML, then narrated explainer videos.
- **Arpit Bhayani:** human attention is not built for *zero-context scrutiny*, yet that is what reviewing AI-written
  code asks for. Code review should become **code understanding**.

Apply Karpathy's ladder to code and you get Arpit's answer. The full reasoning, and how this improves on
[answer-me-with-html](https://github.com/QingYunA/answer-me-with-html), is in [PLAN.md](PLAN.md).

## How it works

The model writes a short Markdown **draft**. A zero-dependency Node CLI turns it into one offline HTML file: layout,
SVG coordinates, interactivity, light/dark, all computed. The model never writes HTML, CSS or SVG — and **never
retypes code**: it points at `src/auth.js:40-52` or diff hunk `H3`, and lucid reads the real lines from disk or git.

````markdown
---
title: Review — refresh sessions inside a grace window
tldr: The refresh never reaches the client, so users still get logged out. Do not merge yet.
verdict: changes
---
## The refresh itself — the main problem
```diff H1
+12: The code stores the new session under `randomUUID()` and never returns that token.
+10-17: If `putSession` keeps failing, this loop never ends. There is no attempt limit.
```
````

For these two examples the model wrote 2.7 KB and 4.3 KB of draft. lucid turned them into 15 KB and 43 KB of page
markup, plus 35 KB of fixed CSS and runtime the model never sees. (These are byte counts, not a model benchmark —
see [PLAN.md](PLAN.md) for the benchmark we still owe.)

## What you get

**Explain mode**

- `flow` diagrams with an automatic layered layout, and `sequence` diagrams — both **play step by step** with a caption
  per step.
- `tree`, `timeline`, `chart` (bar / line, real numbers only), `kv`, `callout`, tables with ✓ ✗ ! badges.
- `glossary`: define a term once, every later use gets a hover definition.
- `quiz`: check-yourself questions with instant feedback. `checklist`: ticks persist in the browser.
- `[[path:line]]` references that preview the real code on hover; `code path:10-40` blocks with margin notes.

**Review mode** (code understanding)

- `lucid diff` gives the agent hunk ids over committed, uncommitted *and* untracked work.
- `diff H3` blocks show the real hunk with notes pinned to the lines that matter.
- `changemap` shows the shape of the change; `risks` ranks what could break, linked to the code.
- A coverage meter — **"4/4 changes explained"** — and an *All changes* appendix that flags anything the walkthrough
  skipped. Nothing hides in a review.

![A diff hunk with notes pinned to the lines that matter](docs/images/review-diff-notes.png)

**For both**

- **Tour:** a narrated walkthrough of the page (tldr → sections → diagram steps), in the browser.
- **Video:** `lucid video page.html` records the tour to MP4, voiced by ElevenLabs (`ELEVENLABS_API_KEY`), macOS `say`
  or `espeak`, with captions-only as the fallback.
- **Self-check:** `--check` renders the page in headless Chromium at 1280 px and 390 px, reports overflow, overlapping
  labels and runtime errors, and saves a screenshot the agent looks at before answering.
- **Plain-English lint:** a required one-line answer (`tldr`), sentence length, wordy words, passive voice, walls of
  text.
- Errors the agent can fix in one try: `✗ L4 [flow] Arrow is missing a node on one side` plus a correct example.

## Does an agent actually use it well?

We gave SKILL.md, and nothing else, to fresh agents with no context:

- **Explain** ("git merge vs rebase"): 7 sections, 4 diagrams, a glossary and a quiz. One fix round (a passive
  sentence, overlapping groups), then a clean render.
- **Review** (the demo branch above): verdict *block*, **4/4 hunks explained**. It found both bugs in the change and
  one we had not planted: the committed `session.js` imports `refresh.js`, which is untracked, so merging only the
  commits would break startup.

Their friction reports drove fixes in this version: cut-off tables are now detected, warnings quote the sentence they
mean, diff notes and step captions are linted, edge labels no longer sit under nodes, and `check --section` gives a
sharp close-up.

## Install

Node.js 20+. Nothing to `npm install`. Video export and `--check` use Playwright and ffmpeg if they are present.

**Claude Code plugin**

```
/plugin marketplace add Inspire-Labs-AI/html-skill
/plugin install lucid@lucid
```

**Any agent with skills** (Claude Code, Codex, Cursor, OpenCode, …): copy `skills/lucid` into the agent's skill folder,
e.g. `cp -R skills/lucid ~/.claude/skills/lucid`.

## Use the CLI directly

```bash
L=skills/lucid/scripts/lucid.mjs
node $L render examples/tcp.md --check          # page + layout check + screenshot
node $L diff                                    # hunk index of the current change
node $L render review.md --check                # run inside the repository under review
node $L video ~/.lucid/pages/page.html          # narrated MP4 of the page's tour
node $L help flow                               # syntax for one component; `node $L list` for all
```

Try the review example yourself:

```bash
examples/make-review-demo.sh /tmp/lucid-demo && cd /tmp/lucid-demo
node "$OLDPWD/skills/lucid/scripts/lucid.mjs" render "$OLDPWD/examples/review-token-refresh.md" --check
```

Pages go to `~/.lucid/pages/` (set `LUCID_HOME` to move them, `-o` for one file). Code links use
`vscode://file/{abs}:{line}`; set `LUCID_LINK` (tokens `{abs}`, `{path}`, `{line}`) for another editor.

## Develop

```bash
npm test     # node --test, no dependencies
```

Source: `skills/lucid/scripts/` — `lib/parse.mjs` (draft), `lib/layout.mjs` (graph layout), `lib/components/`,
`lib/git.mjs` (diff + hunk ids), `lib/repo.mjs` (code references), `lib/lint.mjs`, `lib/check.mjs`, `lib/video.mjs`,
`assets/` (CSS + browser runtime).
