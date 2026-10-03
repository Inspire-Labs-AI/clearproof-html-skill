---
name: lucid
description: Turn an answer or a code change into one HTML page a human understands fast — explainers with step-through diagrams, charts, glossaries and quizzes, and code reviews that walk through the real diff with every changed hunk accounted for; optionally a narrated video. The model writes a short Markdown draft; the bundled CLI does layout, SVG, interactivity and checks. Use it without being asked when an answer has 3+ connected ideas, a flow/protocol/architecture, a comparison on 3+ dimensions, a hierarchy or timeline, or when the user must understand or review a change (AI-written code, a branch, a PR, "what did you change", "walk me through this diff"). Also on "explain visually / draw it / make a page / html / review this / help me understand this code". Not for short answers, commands to copy, or when the user asks for plain text.
---

# lucid — make the output understandable, not just correct

Reading is now the bottleneck: people spend more time understanding model output than producing it. lucid moves an answer up the ladder **plain text → controlled prose → diagrams → interactive page → narrated video**, and turns code review into **code understanding**: context first, real code second, nothing hidden.

You write only the **draft** (extended Markdown). The CLI writes all HTML, CSS, SVG coordinates and JavaScript. **Never hand-write HTML/CSS/SVG. Never retype code — reference it.**

```bash
L="node ${CLAUDE_SKILL_DIR}/scripts/lucid.mjs"   # if the variable is not expanded, use this file's folder
```

## 1. Pick the mode

| The user needs to… | Mode | First command |
|---|---|---|
| understand a concept, system, codebase, decision | **explain** | — |
| understand / review a change (diff, branch, AI-written code) | **review** | `$L diff` |
| watch it (or share it as a clip) | either, then **video** | `$L video page.html` |

No page for: one-line answers, commands to paste, pure code edits, "plain text please".

## 2. Write the draft

````markdown
---
title: How TCP opens a connection
tldr: Three messages prove both sides can send and receive.     ← REQUIRED: the answer in one line
subtitle: optional
---
Optional one-paragraph intro.

## The handshake {span=2 say="Watch the three messages."}
```sequence
Client -> Server: SYN | caption shown when this step plays
Server --> Client: SYN+ACK
```
````

Rules that make pages good:
- **Answer first.** `tldr` is the conclusion, not the topic. Then 3–8 sections (reviews: up to 10), each answering one question, ordered the way understanding builds (why → shape → mechanism → edge cases → check).
- **One visual per section** where the information has a shape; prose only for the why. More than ~160 words of prose with no visual is flagged.
- **Write in plain English (ASD-STE100 style):** one idea per sentence, ≤25 words (≤20 for steps), active voice, steps as commands, common words (use, not utilize). lint warns.
- **Ground every claim about code:** `[[src/auth.js:42]]` or `[[src/auth.js:40-52]]` inline (hover shows the real lines); ```` ```code src/auth.js:40-60 ```` to show them. lucid fails on a missing file or line — that is the point.
- **No invented numbers.** Charts take real values; say "illustrative" otherwise.
- Layout: explain pages are a 2-column grid of sections (review pages: 1 column). A section alone on its row stretches to fill it, and tables with 4+ columns go full width automatically. Give `{span=full}` to wide diagrams, LR flows and tables with long cells. `say="…"` sets what the tour narrates for that section.
- Put a `glossary` in the intro (before the first `##`) or in its own last section.

## 3. Components (pick by the shape of the information)

| Shape | Component | Minimal syntax |
|---|---|---|
| boxes & arrows, architecture, decisions, state machines | `flow [LR]` | `A -> B: label \| step caption`, `-->` dashed, `==>` main path, `A -> B & C`, `(Start)` `{Decision?}` `[(DB)]` `*Hot`, `group Name: A, B` |
| messages between parties over time | `sequence` | `A -> B: msg \| caption`, `B --> A: reply`, `A -x B: lost`, `note A, B: text`, `== phase ==` |
| hierarchy | `tree` | 2-space indent, `name \| description`, `*hot` |
| history, phases | `timeline` | `when \| title \| description`, `*` highlights |
| quantities | `chart bar\|line unit=ms` | `series: a, b` then `label \| 1.2, 3.4` |
| key facts | `kv` | `Key: value` |
| jargon | `glossary` | `Term: definition` → every later use gets a hover definition |
| conclusion / warning | `callout key\|info\|tip\|ok\|warn\|risk Title` | Markdown body |
| real code with notes | `code path:10-40` | `12: note`, `14-18: note on a range` |
| check understanding | `quiz` | `? question`, `- [x] right`, `- [ ] wrong`, `> why`; open: `? q` + `= answer` |
| things to verify | `checklist` | `- [ ] item [[file:line]]` (ticks persist) |
| comparison | Markdown table | cells starting `ok` / `no` / `warn` become ✓ ✗ ! |

`flow` and `sequence` play step by step (one step per arrow line; the text after ` | ` is the caption). Full syntax: `$L help <component>`, `$L help format`, `$L help review`.

## 4. Review mode (code understanding)

1. `$L diff` — read the index: base, files, hunk ids (`H1`…), and the changed lines (committed, uncommitted and untracked). Use `--base <rev>` if the user names one. Read surrounding code where you need context. If some work is uncommitted or `[untracked]`, check that the committed part stands on its own (imports, migrations) — merging only the commits is a common way to break things.
2. Write the draft. Copy `base:` from the diff output into the front matter. Structure:
   - `tldr` + `verdict: approve | changes | discuss | block` — the finding, not a summary of the diff.
   - **Intent** — what the change is for and the approach, before any code.
   - ```` ```changemap ```` — the shape: `routes.js -> session.js: calls`. Keep arrow labels to 1–2 words (empty body = file list with sizes).
   - **Walkthrough** — one section per idea, **in the order data flows, not file order**. Each shows ```` ```diff H3 ```` with notes on the lines that matter: `+42: …` (added or unchanged line, new-file number), `-17: …` (removed line, old-file number) — the numbers `lucid diff` prints. Explain *why* and *what could go wrong*, not what the line literally says.
   - ```` ```risks ```` — `high | src/x.js:42 | what breaks`, ranked.
   - ```` ```checklist ```` — what a human must still verify (tests, rollout, data).
   - Optional ```` ```quiz ```` — one question that proves the reviewer understood the risky part.
3. **Account for every hunk.** Show it in a `diff` block or cite it inline (`[[H4]] only renames a variable`). The page header shows "N/M changes explained"; render warns about each unexplained hunk, and the "All changes" appendix flags it. Aim for M/M.

## 5. Render, check, look

```bash
$L render - --check <<'LUCID'
---
title: …
tldr: …
---
## …
LUCID
```

- `✓ <path>` → done. `--check` renders it in headless Chromium at desktop and phone width, reports cut-off tables, overflow, overlapping labels and groups, and saves both screenshots next to the page. **Look at the desktop screenshot** (read the PNG) before you answer; the check cannot judge everything (cramped diagrams, a confusing order).
- `✗ L12 [flow] … correct example: …` → fix that line, render again.
- Warnings (readability, coverage, layout) quote the sentence they mean → fix and re-render, at most 2 rounds; then ship and mention what is left. Diff notes and step captions are checked too.
- Full-page screenshots are small. For detail, `$L check <page.html> --section 3` saves a sharp close-up of section 3.
- Review drafts must be rendered from inside the repository (the CLI reads git and files from the current directory).
- Pages go to `~/.lucid/pages/` (`-o file.html` to choose). They are single offline files. The browser opens automatically on a desktop; pass `--no-open` when the user should not be interrupted.

Reply in the terminal with 1–3 lines: the conclusion (for reviews: the verdict and the top risk) and the page path. Do not paste the draft or the HTML.

## 6. Video (optional)

`$L video <page.html> [-o out.mp4] [--voice auto|elevenlabs|say|espeak|none]` records the page's tour — the tldr, each section's `say` text, each diagram step's caption — and encodes an MP4. Voice: ElevenLabs if `ELEVENLABS_API_KEY` is set, else macOS `say` or `espeak`, else captions only. Write good `say=` lines and step captions; they are the script. Takes about real time plus a few seconds.
