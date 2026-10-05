# Benchmark: lucid vs visual-explainer vs answer-me-with-html vs plain HTML

Blind, screenshot-judged comparisons with the same model under every condition. Last run on 2026-10-05 (round 4).

## Contestants

| | What the agent had |
|---|---|
| **A — plain HTML** | "Answer me with an HTML page", plus a screenshot tool to check its own page |
| **B — [answer-me-with-html](https://github.com/QingYunA/answer-me-with-html)** | That skill's SKILL.md and CLI (v0.2) |
| **C — lucid** | This skill (the version at the time of each round) |
| **D — [visual-explainer](https://github.com/nicobailon/visual-explainer)** | The most adopted skill in this space (10.2k★): SKILL.md, references, templates, commands |

Each run was a fresh agent with no prior context. Each page was then judged by a fresh agent that saw **only
screen-sized screenshots**, under shuffled labels, with no idea which skill made what. The explain judges answered six
comprehension questions from each page alone; the review judges played an engineer deciding whether to merge without
reading the code. Answer keys and planted bugs were fixed before any run.

## Results

### Latest round (4): lucid is first on both tasks

| Round 4 | lucid | visual-explainer | plain HTML | answer-me-with-html |
|---|---|---|---|---|
| Explain (garbage collection), set 1 — score /20 | **18** (tied top; 2nd on tiebreak) | 18 (1st on tiebreak) | 13 | 11 |
| Explain (garbage collection), set 2 — score /20 | **18 — 1st** | 17 | 15 | 16 |
| **Explain average** | **18.0** | 17.5 | 14.0 | 13.5 |
| Review (password reset, re-run with the new SKILL.md) | **1st** (5/5 verify, completeness, trust) | 3rd | 2nd | 4th |
| Time per page (explain) | 175 s | 379 s | 145 s | 75 s |

The explain judges on lucid: "the diagrams show the mechanism step by step: a stepper for reachability, an
Eden-copy animation, and a pause-vs-live-data slider… quizzes and sources make it the most teachable page"; "strongest
evidence of the four: sources are linked, every number cross-checks". lucid now spends more time per page (plan,
figures, critique) — by design: quality first, still about half of visual-explainer's time.

What changed for round 4 (from a close read of visual-explainer and research on explorable explanations):
bespoke `figure` blocks with a kit (player, steps, before/after, toggle, slider, readouts), an editorial layout
(answer-as-headline, kickers, claim headings), numbered captions, `cases` small multiples, chart highlights and
annotations, per-figure close-ups for a judge-style critique pass, and checks for tiny text, label headlines,
inconsistent numbers, and captions that only name the figure.



| Round | Task | lucid | plain HTML | visual-explainer | answer-me-with-html |
|---|---|---|---|---|---|
| 1 | orders pagination, 4 planted bugs | **1st** | 2nd | — | 3rd |
| 2, set 1 | password reset, 4 planted bugs | **1st** | 2nd | 3rd | 4th |
| 2, set 2 | same task, independent runs | **1st** | 2nd | 3rd | 4th |
| 4 | password reset, new SKILL.md | **1st** | 2nd | 3rd | 4th |

**lucid ranked first in every review judgment.** In round 2 both judges gave it 5/5 on *ability to verify*,
*completeness* and *overall trust*. Typical judge line: "the only page that proves its claims: executed commands with
real output for the key bugs, a Verified / Inferred / Not-verified label on every claim, and a 4/4 hunks-explained
index proving coverage." Every condition found the planted bugs; finding them is the model's job. The difference is
whether a reviewer can **check** the findings and **know nothing was skipped**.

### Explain: a new topic each round

| Round | Topic | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|---|
| 1 | DNS | **lucid** (narrowly) | answer-me-with-html | plain HTML | — |
| 2, set 1 | database indexes | visual-explainer | plain HTML | lucid | answer-me-with-html |
| 2, set 2 | database indexes | visual-explainer | plain HTML | answer-me-with-html | lucid |
| 3, set 1 | CPU caches | plain HTML (18/20) | visual-explainer (18) | lucid (15) | answer-me-with-html (14) |
| 3, set 2 | CPU caches | visual-explainer (18/20) | plain HTML (17) | lucid (16) | answer-me-with-html (12) |
| 4, set 1 | garbage collection | visual-explainer (18/20, tiebreak) | **lucid (18)** | plain HTML (13) | answer-me-with-html (11) |
| 4, set 2 | garbage collection | **lucid (18/20)** | visual-explainer (17) | answer-me-with-html (16) | plain HTML (15) |

**Explainers: lucid went from 3rd/4th (rounds 2–3) to joint-first in round 4** (average 18.0 vs 17.5). Between rounds 2 and 3 lucid moved from 3rd/4th
to a steady 3rd, 2–3 points behind on a 20-point scale. It scores the **highest trust** in every explain round
(real measurements, claim labels), but loses on **visuals**: the leaders hand-draw bespoke, often interactive figures
(a cache simulator with live hit/miss counts, a B-tree walk with real keys). lucid's components are cheaper and safer
but less expressive.

### Cost and speed (round 2 and 3 averages per page)

| | plain HTML | answer-me-with-html | lucid | visual-explainer |
|---|---|---|---|---|
| Explain | 124 s | 66 s | 114 s | 400 s |
| Review | 140 s | 77 s | 87 s | 326 s |
| Tokens per run | ~60–75k | ~60–70k | ~60–65k | ~120–135k |

visual-explainer's figures cost about **4× the time and 2× the tokens** of lucid.

## How the harness was kept honest

Three harness bugs were found and fixed before results were counted, and every affected round was re-judged:

1. **Scroll-revealed content.** visual-explainer fades sections in on scroll; static capture showed blank screens and
   unfairly sank it. Fixed: the tiler scrolls through each page like a reader.
2. **Smooth scrolling.** lucid's smooth scroll made the first tile start mid-page, hiding its verdict and summary.
   Fixed: instant scrolling, and every page's first tile was checked by eye before judging.
3. **Lost pages.** Some answer-me-with-html agents deleted earlier pages in a shared output folder. Those runs were
   repeated in separate folders with the same prompt.

The explain topic changed every round, so lucid was never re-tested on a topic it had been tuned against. Examples in
SKILL.md were also scrubbed of a benchmark topic that had leaked into them.

## What each round changed in lucid

| After | Judges said | Change |
|---|---|---|
| Round 1 | "No such name" became "✗ such name"; code cut off at the right edge; no critical tier | lowercase status keywords; wrapping code; `critical` risks |
| Survey of 10 competing skills | — | claim ledger, Checked strip, linked highlighting, side-by-side code, explained quiz options |
| Round 2 review | red ✗ chips read like failures; risks too far down; quiz padding | `shows:` evidence; risks first; lint against padding |
| Round 2 explain | generic boxes; numbers retyped wrongly from a benchmark | record nodes with real data, faded skipped paths, `waffle`, log charts, a lint that checks chart numbers against run output, one reading column |
| Round 3 explain | raw /tmp paths; "0.08 int per square"; self-awarded badge | paths tidied in run output, small waffles use one cell per unit, neutral "Checked" label |

## Limits

- n = 2 per cell in rounds 2–3, and model judges rather than people.
- Judges see static screenshots: step-through diagrams, hover links, tours and video are not scored, which favours
  pages that pack everything into the static view.
- One model family produced and judged everything.

## Next

More runs per cell to separate a narrow lead from noise; human judges; scoring the interactive states (step N, slider
at max) instead of the static first frame.
