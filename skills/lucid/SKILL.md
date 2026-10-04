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
- **Explainers open with "The short version":** a numbered list of 3–7 plain steps a newcomer can follow, before any diagram or table. Readers rate this the clearest part of a page.
- **Draw the real data, not boxes.** Put actual values in diagrams: `[g; p]` record nodes for keys, fields or memory cells, `~` to fade what the process skips, `*` for the path it takes. A diagram of generic steps ("Row 1 → Row 2 → …") explains nothing — cut it.
- **Never retype a measured number.** If a `run` block measured it, chart exactly those numbers (lint checks) or show the run output alone.
- **Write for a named reader.** `for: a backend dev new to databases` in the front matter shows as "Written for: …" and should change what you include, not just the wording.
- **Show, then tell.** Prefer a concrete example (real names, real numbers, real tool output via ```` ```run ````) over abstract description. State what you simplified in one `callout info` line; honest caveats raise trust.
- **One visual per section** where the information has a shape; prose only for the why. More than ~160 words of prose with no visual is flagged.
- **Write in plain English (ASD-STE100 style):** one idea per sentence, ≤25 words (≤20 for steps), active voice, steps as commands, common words (use, not utilize). lint warns.
- **Ground every claim about code:** `[[src/auth.js:42]]` or `[[src/auth.js:40-52]]` inline (hover shows the real lines); ```` ```code src/auth.js:40-60 ```` to show them. lucid fails on a missing file or line — that is the point.
- **No invented numbers.** Charts take real values; say "illustrative" otherwise.
- Layout: one reading column by default (`cols: 2` gives a grid of cards for dashboard-like overviews; then sequences, LR flows, code and wide tables span the full row automatically). Give `{span=full}` to wide diagrams, LR flows and tables with long cells. `say="…"` sets what the tour narrates for that section.
- Put a `glossary` in its own section near the end: hover definitions work everywhere, and a glossary first delays the overview.

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
| real code with notes | `code path:10-40 [side]` | `12: note`, `14-18: note on a range`; `side` puts plain-English notes in a column beside the code — best for line-by-line walkthroughs |
| check understanding | `quiz` | `? question`, `- [x] right :: why`, `- [ ] wrong :: why it is wrong`, `> summary`; open: `? q` + `= answer`. Ask what would *happen* (change a condition, trace a request, pick a fix), never recall of names. Explain every option. |
| how sure is each claim | `claims` | `verified \| claim \| [[file:line]] / H3 / run / URL`, `inferred \| claim \| what it rests on`, `unverified \| claim` |
| things to verify | `checklist` | `- [ ] item [[file:line]]` (ticks persist) |
| proof: real command output | `run` | `$ command`, `shows: text` (evidence of behaviour), `expect:` / `absent:` (assertions), `note: caption` — lucid runs it and embeds the output (render with `--allow-run`) |
| comparison | Markdown table | cells starting `ok` / `no` / `warn` become ✓ ✗ ! |
| one key ratio, felt | `waffle unit=requests` | `Cache hits \| 997 of 1000 \| note` — a grid of cells per row; put the big whole first |

`flow` and `sequence` play step by step (one step per arrow line; the text after ` | ` is the caption). Names of nodes and actors that you use in the section's prose light up the diagram on hover automatically — so use the same names in both.

**Every number gets a picture** (a `chart`, a `waffle`, a table, a timeline) or it gets cut. **Open with a hero:** right after the short version, one big visual that makes the key number felt — e.g. a `waffle` of "3 of 1,000 requests" or a `chart` of before/after (`scale=log` when values span orders of magnitude). Use `flow LR` for linear chains; tall thin diagrams waste the page. When several cases differ in one detail, show the same small diagram once per case rather than one diagram with every branch. Full syntax: `$L help <component>`, `$L help format`, `$L help review`.

## 4. Review mode (code understanding)

The header automatically shows provenance (base, head, uncommitted work) and a **Grounded** strip: code references checked, hunks shown, commands run, claims verified. Make those numbers high — that is what lets a reviewer trust the page.

1. `$L diff` — read the index: base, files, hunk ids (`H1`…), and the changed lines (committed, uncommitted and untracked). Use `--base <rev>` if the user names one. Read surrounding code where you need context. If some work is uncommitted or `[untracked]`, check that the committed part stands on its own (imports, migrations) — merging only the commits is a common way to break things.
2. Write the draft. Copy `base:` from the diff output into the front matter. A reviewer is busy: verdict and risks first, evidence next, walkthrough last. Structure:
   - `tldr` + `verdict: approve | changes | discuss | block` — the finding, not a summary of the diff.
   - **Risks first** (section 1) — ```` ```risks ```` with `critical | src/x.js:42 | what breaks`; levels critical (security, data loss, data leak) / high / med / low. Under each serious risk add indented lines: `why:` (the mechanism), `trigger:` (a concrete input, e.g. the exploit payload), `fix:`. Include behaviour changes for callers (API shape, defaults) and committed code that depends on uncommitted or untracked files.
   - **Proof** — ```` ```run ```` blocks that reproduce each critical/high risk by **calling the real code** (import the module, run a test) — not by copying a line into `eval`. Use `shows:` with the buggy output (the page shows "✓ output shows …" as evidence). If the real code cannot run (missing dependency), say so in `note:` and mark the claim inferred. Fast, local, read-only; never destructive or networked. Render with `--allow-run`.
   - **Intent** — what the change is for and the approach, in 2–4 bullets.
   - ```` ```changemap ```` — the shape: `routes.js -> session.js: calls`. Keep arrow labels to 1–2 words (empty body = file list with sizes).
   - **Walkthrough** — one section per idea, **in the order data flows, not file order**; one step may show hunks from several files (```` ```diff H2,H4 ````). Each shows the diff with notes on the lines that matter: `+42: …` (added or unchanged line, new-file number), `-17: …` (removed line, old-file number) — the numbers `lucid diff` prints. Explain *why* and *what could go wrong*, not what the line literally says. State the exact value the behaviour turns on (`TTL = 60_000`, `page * 20`). When the code does not say why, say so: "likely…, though nothing in the code states it" — never invent intent.
   - ```` ```claims ```` — the 3–6 claims the verdict rests on, each `verified` (with evidence), `inferred` or `unverified`.
   - ```` ```checklist ```` — the fix list and what a human must still verify.
   - **No quiz, no glossary, no filler in reviews.** Aim for under 6 screens.
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

- Drafts with ```` ```run ```` blocks need `--allow-run`; the CLI reports how many commands ran and which checks failed.
- `✓ <path>` → done. `--check` renders it in headless Chromium at desktop and phone width, reports cut-off tables, overflow, overlapping labels and groups, and saves both screenshots next to the page. **Look at the desktop screenshot** (read the PNG) before you answer; the check cannot judge everything (cramped diagrams, a confusing order).
- `✗ L12 [flow] … correct example: …` → fix that line, render again.
- Warnings (readability, coverage, layout) quote the sentence they mean → fix and re-render, at most 2 rounds; then ship and mention what is left. Diff notes and step captions are checked too.
- Full-page screenshots are small. For detail, `$L check <page.html> --section 3` saves a sharp close-up of section 3.
- Review drafts must be rendered from inside the repository (the CLI reads git and files from the current directory).
- Pages go to `~/.lucid/pages/` (`-o file.html` to choose). They are single offline files. The browser opens automatically on a desktop; pass `--no-open` when the user should not be interrupted.

Reply in the terminal with 1–3 lines: the conclusion (for reviews: the verdict and the top risk) and the page path. Do not paste the draft or the HTML.

## 6. Video (optional)

`$L video <page.html> [-o out.mp4] [--voice auto|elevenlabs|say|espeak|none]` records the page's tour — the tldr, each section's `say` text, each diagram step's caption — and encodes an MP4. Voice: ElevenLabs if `ELEVENLABS_API_KEY` is set, else macOS `say` or `espeak`, else captions only. Write good `say=` lines and step captions; they are the script. Takes about real time plus a few seconds.
