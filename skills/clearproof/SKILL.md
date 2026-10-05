---
name: clearproof
description: Clear visuals, proven answers. Turn an answer or a code change into one HTML page a human understands fast, where every claim is checked (real code, real command output, every change accounted for) — explainers with step-through diagrams, charts, glossaries and quizzes, and code reviews that walk through the real diff with every changed hunk accounted for; optionally a narrated video. The model writes a short Markdown draft; the bundled CLI does layout, SVG, interactivity and checks. Works for any subject — tech, science, learning a topic, health, history, money and everyday decisions — not only code. Use it without being asked when an answer has 3+ connected ideas, a flow/protocol/architecture, a comparison on 3+ dimensions, a hierarchy or timeline, or when the user must understand or review a change (AI-written code, a branch, a PR, "what did you change", "walk me through this diff"). Also on "explain visually / draw it / make a page / html / review this / help me understand this code". Not for short answers, commands to copy, or when the user asks for plain text.
---

# clearproof — clear visuals, proven answers

Reading is now the bottleneck. clearproof turns an answer into a page whose **spine is figures** (text is caption, not content) and turns code review into **code understanding**: verdict first, real code and real proof second, nothing hidden. Quality beats speed: take the extra minutes to plan, draw and critique.

You write a **draft** (extended Markdown). The CLI does layout, typography, diagrams, charts, numbering, checks and screenshots. **Never retype code — reference it.** Hand-write HTML/SVG/JS only inside a ```` ```figure ```` block, for the figure that carries the explanation.

```bash
L="node ${CLAUDE_SKILL_DIR}/scripts/clearproof.mjs"   # if the variable is not expanded, use this file's folder
```

| The user needs to… | Mode | First command |
|---|---|---|
| understand a concept, system, codebase, decision | **explain** (§1–3) | — |
| understand / review a change (diff, branch, AI-written code) | **review** (§4) | `$L diff` |
| watch it | either, then **video** (§6) | `$L video page.html` |

No page for one-line answers, commands to paste, pure code edits, or "plain text please".

## 0. Work in few turns

Every tool call re-reads the whole conversation, so the number of calls — not the words — sets the cost. Aim for **≤ 8 calls** for an explainer, ≤ 10 for a review:

1. Do not call `$L help`: §3 has the syntax. Use help only when a render error names a component you do not know.
2. Numbers that are the answer: write **one** small script and run it in the same call; use its first output, do not tune it. Well-known published numbers can be cited instead.
3. Write the whole draft and render it in **one** call (`$L render - --check <<'CLEARPROOF'`, §5).
4. Read the desktop screenshot and the figure sheet in **one** turn (two Reads side by side).
5. **One** fix round: fix errors, layout problems and your three weakest points together, render, deliver. Never spend a round nudging pixel positions.

Hand-write at most **two** `figure` blocks (the hero and one more), under ~60 lines each. Everything else uses built-in components, which lay themselves out.

## 1. Plan before you write (explain)

1. **The one sentence** the reader must leave with. It becomes the `title`, stated as the answer — the key number first if there is one: "Memory costs **75×** an L1 hit", not "CPU caches".
2. **The hero figure** that makes that sentence visible on the first screen. For **"how does X work?"** the hero is the mechanism itself (a stepper or simulator with real values). For **"how much / which is faster?"** the hero is the number (an annotated chart or waffle). Never open a how-question with a chart of consequences before the reader has seen what happens.
3. **3–6 sections**, each = one claim + the figure that proves it, in the order understanding builds: intuition → mechanism (stepped, with real values) → numbers → cases where it breaks → what to remember. Write each section title as its claim.
4. For each figure, pick the form by the information (§3). Sketch it in your head with **real values** (actual addresses, keys, timings, sizes), not placeholders.

## 2. Write the draft

````markdown
---
kicker: CPU caches                          ← small label above the headline
title: A cache hit takes 1 ns. Memory takes 90.     ← the answer, number first
tldr: The CPU keeps recently used **64-byte lines** close to the core, so most reads skip the 90 ns trip.   ← lead: 1–2 sentences, one bold phrase
for: a programmer who knows arrays and loops
---
## The hero {hero}                           ← {hero}: no heading, sits right under the lead
```chart bar unit= ns caption="One trip to memory costs as much as 90 L1 hits."
L1 | 1
*DRAM | 90 ! one cache miss
```

## Each miss fetches a whole 64-byte line {kicker="Mechanism"}
One short paragraph of why. Then the figure that shows it.
```figure caption="Reading a[0] misses and brings in a[0]–a[15]; the next 15 reads hit."
… HTML/SVG + <script> using the L kit (§3) …
```
````

Rules (the judges' rubric is Clarity · Visuals · Readability · Trust):
- **Figures carry the page.** Every section has a figure; figures outnumber prose paragraphs. If a sentence describes the picture, make it a label in the picture. Every figure gets `caption="…"`: one sentence that states its claim or what to notice ("Fig. N" is added).
- **Draw the mechanism, not the name.** A request moving through a cache beats a box labelled "cache". Use real values. Show what the process does *not* touch (`~` fades it). A chain of generic boxes ("Step 1 → Step 2") explains nothing — cut it.
- **A process that changes over time gets a stepper** with a one-line caption per step and real values in every caption. Open on the full picture; never autoplay.
- **A setting the reader should feel gets a live figure:** 1–3 controls (slider/toggle) driving one pure `model(settings)` that redraws the figure and the numbers; default to the real value; say "illustrative" if simplified.
- **Every number gets a picture** (chart, waffle, bars) with the comparison stated. Highlight the bar that matters (`*row`) and annotate it in place (`value ! note`). Use `scale=log` across orders of magnitude.
- **Cases become small multiples** (`cases`): the same mini diagram per case; only the difference changes.
- **One concept, one name, one number.** The same quantity must have the same value everywhere (render prints a per-unit number inventory — check it). Measured numbers are copied exactly from `run` output, and a headline number from a small benchmark says its scale ("on 50,000 vectors") — a toy run's 2% is not a claim about millions.
- **Plain English (ASD-STE100):** one idea per sentence, ≤25 words, active voice, short paragraphs (1–3 sentences), common words, `×` not `x`, a space before units.
- **Trust:** cite sources with links in a final `## Sources` section (never collapsed); ground code claims with `[[file:line]]`; label models "illustrative"; one `callout info` line for what you simplified. Proof beats assertion: a `run` block showing real output is the strongest evidence. This holds outside code too: for money, physics or statistics, write a small script (in the scratchpad or the user's folder), `run` it, and quote its output — never compute numbers in your head.
- **Name the parts first, predict before the key figure.** Introduce the 3–5 parts by name (one line each, or in the hero) before the mechanism. Right before the most important figure, ask one `quiz` prediction ("What happens on the next read?"); the figure then shows the answer.
- **End with understanding:** a `quiz` of 2–3 *application* questions (what happens if…), every option explained (`- [ ] option :: why`). Glossary, if any, goes last.

## 3. Figures and components (pick by the shape of the information)

| Shape | Use | Minimal syntax |
|---|---|---|
| **the mechanism itself** (a simulator, a walk with real data, before/after) | `figure` | HTML/SVG + `<script>` with the **L kit**: `L.player(fig,{steps,onStep,labels})` · `L.steps(fig,captions)` (parts with `data-s="k"` appear at step k) · `L.beforeAfter(fig)` (`.only-before`/`.only-after`) · `L.toggle(fig,labels,fn)` · `L.slider(fig,{label,min,max,value,format},fn)` · `L.readout(fig,label).set(x)` · `L.el` · `L.svg` · `L.color('accent')`. Theme classes: `.cell .cell.hit .cell.miss .cell.on .cell.dim .tag .mono .muted`. `wide` for full width. |
| boxes & arrows, architecture, state machines | `flow [LR]` | `A -> B: label \| step caption`, `-->` dashed, `==>` main path, `[g; p]` record node with real values, `~X` faded, `*X` highlighted, `(Start)` `{Decision?}` `[(DB)]` |
| messages between parties over time | `sequence` | `A -> B: msg \| caption`, `B --> A: reply`, `note A: text`, `== phase ==` |
| cases, failure modes, options | `cases` | `# risk \| Key expired \| 9 ms` then flow lines; `*` = the part that matters, `~` = down |
| magnitudes | `chart bar\|line unit=ms [scale=log]` | `label \| 1.2`, `*label \| 300 ! note`; `series: a, b` for 2–4 series |
| one ratio, felt | `waffle unit=reads` | `Hash lookup \| 1 of 1000 \| note` |
| hierarchy · history | `tree` · `timeline` | indent / `when \| title \| note` |
| proof: real output | `run` | `$ command`, `shows: text`, `expect: text`, `note:` (render with `--allow-run`) |
| claim confidence | `claims` | `verified \| claim \| [[file:line]]/run/URL`, `inferred \| claim \| basis`, `unverified \| claim` |
| real code | `code path:10-40 [side]` | `12: note` (`side` = notes beside the code) |
| check understanding | `quiz` | `? q`, `- [x] right :: why`, `- [ ] wrong :: why` |
| also | `callout`, `kv`, `glossary`, `checklist`, tables (`ok`/`no`/`warn` cells → ✓ ✗ !) | `$L help <name>` for full syntax |

Figure craft: an architecture with more than ~6 parts goes top-down (`flow`, no `LR`) or in 2–3 `group`s, never one long row, which shrinks every label; labels ≥ 12 px (the check warns below 11 px — widen the figure or shorten labels); one idea per figure; label directly instead of legends; colour encodes status only (accent = the thing that matters); the initial frame (no clicks) must already show the answer, because many readers never press play. Keep a `figure` under ~60 lines.

## 3b. Before delivery: critique like a judge

After `$L render - --check` (§5), read the desktop screenshot and the **figure sheet** it saves (`…-figs.png`, every figure close up on one image), then score your page 1–5 on **Clarity, Visuals, Readability, Trust** as a strict reader who has never seen the topic. Fix the three weakest things in one round and render again (§0). Check:
□ first screen = the answer: headline + lead + hero figure
□ every section title is a claim; every section has a figure with a caption
□ every figure shows the mechanism with real values, readable without clicking
□ every number has a picture; the number inventory (printed by render) shows no conflicting values — "about 1 ms" in the text and "1–10 ms" in a figure is a conflict
□ no text under 11 px; no overlaps; no layout warnings; phone width works
□ sources listed; simplifications labelled; measured numbers match `run` output
□ prose is short; nothing on the page repeats what a figure already shows

## 4. Review mode (code understanding)

The header automatically shows provenance (base, head, uncommitted work) and a **Checked** strip: code references checked, hunks shown, commands run, claims verified. Make those numbers high — that is what lets a reviewer trust the page.

1. `$L diff` — read the index: base, files, hunk ids (`H1`…), and the changed lines (committed, uncommitted and untracked). Use `--base <rev>` if the user names one. Read surrounding code where you need context. If some work is uncommitted or `[untracked]`, check that the committed part stands on its own (imports, migrations) — merging only the commits is a common way to break things.
2. Write the draft. Copy `base:` from the diff output into the front matter. A reviewer is busy: verdict and risks first, evidence next, walkthrough last. Structure:
   - `tldr` + `verdict: approve | changes | discuss | block` — the finding, not a summary of the diff.
   - **Risks first** (section 1) — ```` ```risks ```` with `critical | src/x.js:42 | what breaks`; levels critical (security, data loss, data leak) / high / med / low. Under each serious risk add indented lines: `why:` (the mechanism), `trigger:` (a concrete input, e.g. the exploit payload), `fix:`. Include behaviour changes for callers (API shape, defaults) and committed code that depends on uncommitted or untracked files.
   - **Proof** — ```` ```run ```` blocks that reproduce each critical/high risk by **calling the real code** (import the module, run a test) — not by copying a line into `eval`. Use `shows:` with the buggy output (the page shows "✓ output shows …" as evidence). If the real code cannot run (missing dependency), say so in `note:` and mark the claim inferred. Fast, local, read-only; never destructive or networked. Render with `--allow-run`.
   - **Intent** — what the change is for and the approach, in 2–4 bullets.
   - ```` ```changemap ```` — the shape: `routes.js -> session.js: calls`. Keep arrow labels to 1–2 words (empty body = file list with sizes).
   - **Walkthrough** — one section per idea, **in the order data flows, not file order**; one step may show hunks from several files (```` ```diff H2,H4 ````). Each shows the diff with notes on the lines that matter: `+42: …` (added or unchanged line, new-file number), `-17: …` (removed line, old-file number) — the numbers `clearproof diff` prints. Explain *why* and *what could go wrong*, not what the line literally says. State the exact value the behaviour turns on (`TTL = 60_000`, `page * 20`). When the code does not say why, say so: "likely…, though nothing in the code states it" — never invent intent.
   - ```` ```claims ```` — the 3–6 claims the verdict rests on, each `verified` (with evidence), `inferred` or `unverified`.
   - ```` ```checklist ```` — the fix list and what a human must still verify.
   - **No quiz, no glossary, no filler in reviews.** Aim for under 6 screens.
3. **Account for every hunk.** Show it in a `diff` block or cite it inline (`[[H4]] only renames a variable`). The page header shows "N/M changes explained"; render warns about each unexplained hunk, and the "All changes" appendix flags it. Aim for M/M.

## 5. Render, check, look

```bash
$L render - --check <<'CLEARPROOF'
---
title: …
tldr: …
---
## …
CLEARPROOF
```

- Drafts with ```` ```run ```` blocks need `--allow-run`; the CLI reports how many commands ran and which checks failed.
- `✓ <path>` → done. `--check` renders it in headless Chromium at desktop and phone width, reports cut-off tables, overflow, overlapping labels and groups, and saves both screenshots next to the page. **Look at the desktop screenshot** (read the PNG) before you answer; the check cannot judge everything (cramped diagrams, a confusing order).
- `✗ L12 [flow] … correct example: …` → fix that line, render again.
- Warnings (readability, coverage, layout) quote the sentence they mean → fix and re-render once; then ship and mention what is left. Diff notes and step captions are checked too.
- Full-page screenshots are small. For detail, `$L check <page.html> --section 3` saves a sharp close-up of section 3.
- Review drafts must be rendered from inside the repository (the CLI reads git and files from the current directory).
- Pages go to `~/.clearproof/pages/` (`-o file.html` to choose). They are single offline files. The browser opens automatically on a desktop; pass `--no-open` when the user should not be interrupted.

Reply in the terminal with 1–3 lines: the conclusion (for reviews: the verdict and the top risk) and the page path. Do not paste the draft or the HTML.

## 6. Video (optional)

`$L video <page.html> [-o out.mp4] [--voice auto|elevenlabs|say|espeak|none]` records the page's tour — the tldr, each section's `say` text, each diagram step's caption — and encodes an MP4. Voice: ElevenLabs if `ELEVENLABS_API_KEY` is set, else macOS `say` or `espeak`, else captions only. Write good `say=` lines and step captions; they are the script. Takes about real time plus a few seconds.
