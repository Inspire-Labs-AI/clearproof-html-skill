# lucid — plan and thesis

## The two inputs

**Andrej Karpathy** ([tweet](https://x.com/karpathy/status/2105819303471976479)): as LLMs do more of the work, people
spend more of their time *understanding* model output. He gave a ladder of formats, from cheapest to richest:

1. **Writing** in ASD-STE100 (Simplified Technical English, from aircraft maintenance manuals): short sentences,
   active voice, one word = one meaning, steps as commands.
2. **Diagrams and images**: easier to take in than text.
3. **HTML pages**: ask for the answer "in HTML" and get an interactive page with animations.
4. **Explainer videos**: 3Blue1Brown-style, narrated (e.g. ElevenLabs). The format he is most bullish on.

**Arpit Bhayani** (building px0, a read-only IDE for reviewing AI-generated code): "Human attention spans are not
really designed for zero-context scrutiny, but here we are, trying to review AI-generated code." His reframe: code
review becomes **code understanding**.

## The thesis that joins them

Karpathy's ladder, applied to code, is Arpit's problem. When an agent writes 400 lines, the reviewer's bottleneck is
not reading speed, it is *context*: what is this for, how do the pieces connect, where is the risk, did I see
everything? A diff in file order answers none of that. So one tool should do both jobs:

- **explain** anything (a concept, a system, a codebase), and
- **explain a change** (a branch, a PR, uncommitted agent work) so a human can judge it.

## What existed: QingYunA/answer-me-with-html

Its good idea, which we keep: the model writes a short Markdown draft; a bundled CLI does the layout, the SVG and the
theme. It cuts output tokens about 7× and time about 3.6× compared with asking for HTML directly.

Where it stops short of the ladder above:

| Gap | Effect |
|---|---|
| Static pages only | The thing HTML adds over an image (interaction, motion) is missing |
| No video | The top rung, the one Karpathy is most bullish on, is absent |
| No code grounding | "Explain this repo" pages cannot point at real lines; code shown is retyped by the model |
| No review mode | Nothing for the "understand this AI-written change" job |
| Nobody looks at the output | Overlapping labels or overflowing panels ship unseen |
| 8 components, no charts | Quantities fall back to raw HTML, which brings the token cost back |
| Benchmarks measure speed only | Tokens and seconds, not whether the reader understood |

## Design principles

1. **The model writes content; the compiler writes HTML.** Same win on tokens and latency.
2. **Never retype code.** Drafts reference `path:lines` or diff hunk ids (`H3`). The CLI reads the real text from disk
   or git. Cheaper, and it cannot hallucinate code. A reference to a missing file or line is a compile error.
3. **Account for every change.** Review pages count hunks shown or cited, show "N/M changes explained" in the header,
   warn about each unexplained hunk, and list all of them in an appendix. Nothing hides.
4. **Context before code.** Review pages lead with the verdict and intent, then the shape of the change, then a
   walkthrough in data-flow order (not file order), then risks, then what a human must still verify.
5. **Interactive by default.** Diagrams play step by step with captions. Code references preview the real lines on
   hover. Glossary terms define themselves on hover. Quizzes check understanding. Checklists remember their state.
6. **Tour = video script.** Every page has a narrated tour (tldr → sections → diagram steps). The same tour, recorded
   in headless Chromium and voiced, becomes an MP4.
7. **The agent checks its own output.** `--check` renders the page at desktop and phone width, reports layout faults
   in the same shape as draft errors, and saves a screenshot the agent reads before answering.
8. **Plain English, enforced.** STE-inspired lint on the prose: sentence length, wordy words, passive voice, walls of
   text, a missing one-line answer.
9. **One offline file, zero dependencies.** Node 20+, no npm install, no CDN. Pages embed their own draft.

## Status (v0.1, this branch)

| Rung | What ships |
|---|---|
| Writing | `tldr` required; STE-style lint (length, wordy words, passive, paragraph size, walls of text) |
| Diagrams | `flow` (own layered layout engine, groups, shapes), `sequence`, `tree`, `timeline`, `chart` (bar/line), `kv`, `callout`, tables with ✓ ✗ ! |
| Interactive page | step-through playback for `flow`/`sequence`, hover previews for `[[path:line]]`, `glossary`, `quiz`, `checklist`, contents rail, light/dark, narrated tour (Web Speech) |
| Video | `lucid video`: records the tour and encodes MP4; ElevenLabs / `say` / `espeak` narration, captions-only fallback |
| Code understanding | `lucid diff` (hunk ids over committed + uncommitted + untracked work), `diff` blocks with line notes, `changemap`, `risks`, coverage meter, all-changes appendix, `code` blocks from disk |
| Self-check | `--check`: headless Chromium at 1280px and 390px; overflow, overlapping labels, labels on nodes, overlapping groups, runtime errors; screenshot |

## Validation so far

Two cold-read trials: fresh agents given only SKILL.md and the CLI's help.

| Trial | Result | What it exposed (now fixed) |
|---|---|---|
| Explain: git merge vs rebase | 7 sections, 4 flows, glossary, quiz; clean after 1 round | cut-off tables were not detected; phone layout was checked but not saved; grid and group behaviour undocumented |
| Review: demo branch | verdict *block*, 4/4 hunks; found both planted bugs plus an unplanned one (committed code imports an untracked file) | warnings gave a line number but not the sentence; diff notes and captions were not linted; edge labels could sit under nodes; full-page screenshots too small to read |

## Next

1. **Comprehension benchmark.** Same questions and same diffs answered three ways (plain HTML, answer-me-with-html,
   lucid). Score tokens, time and cost, plus how well a separate model, given only screenshots, answers quiz
   questions about the topic, and whether reviewers catch planted bugs.
2. **Animated diagrams beyond stepping.** Moving tokens along edges, state values changing per step (the "3b1b" feel).
3. **PR mode.** `lucid diff --pr <url>` and posting the page as a PR artifact; per-hunk "reviewed" state.
4. **Call graph from code.** Draft `changemap` arrows from static analysis instead of by hand.
5. **Always-on hook** (optional plugin): after an agent edits code, offer a review page of its own change.
6. **Commit-graph component** for git-history explainers (trial agents had to fake it with `flow`).
7. **Edge routing around nodes**: long edges in dense graphs can still run close to unrelated nodes.
