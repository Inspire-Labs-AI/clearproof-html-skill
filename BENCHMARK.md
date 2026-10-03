# Benchmark: lucid vs answer-me-with-html vs asking for HTML directly

Run on 2026-10-03. One run per cell (n = 1), so treat these as a first signal, not a verdict.

## Setup

The same model ran every condition as a fresh agent with no prior context.

| Condition | What the agent had |
|---|---|
| **A — direct HTML** | "Answer me with an HTML page", plus a screenshot tool so it could check its own page |
| **B — answer-me-with-html** | That skill's SKILL.md and CLI (v0.2) |
| **C — lucid** | This skill's SKILL.md and CLI (v0.1) |

Two tasks, both new to every agent:

1. **Explain:** "How does DNS resolution work — what happens between typing a URL and getting an IP address?"
2. **Review:** "An AI agent wrote this branch (including uncommitted work). Help me understand it and tell me if it is
   safe to merge." The branch (3 files, +28 −3) hides four bugs, fixed in an answer key before any run:
   off-by-one pagination, a cross-user data leak through the cache key, cache invalidation that never matches, and SQL
   injection through `sort`.

Two **blind judges** (fresh agents) saw only screen-sized screenshots of each page under shuffled labels, with no
interaction. The explain judge answered six fixed DNS questions from each page alone. The review judge played the
engineer who must decide whether to merge without reading the code.

## Results

### Explain (DNS)

| | Direct HTML | answer-me-with-html | **lucid** |
|---|---|---|---|
| Comprehension questions answered from the page | 6/6 | 6/6 | 6/6 |
| Clarity / Visuals / Readability / Trust (1–5) | 5 / 3 / 4 / 5 | 4 / 5 / 4 / 4 | 4 / 5 / 4 / 4 |
| Judge's ranking | 3rd | 2nd | **1st** (close to 2nd) |
| Wall time | 153 s | **46 s** | 71 s |

### Review (planted bugs)

| | Direct HTML | answer-me-with-html | **lucid** |
|---|---|---|---|
| Planted bugs on the page | 4/4 | 4/4 | 4/4 |
| Time to verdict (1–5) | 5 | 5 | 5 |
| Clarity of risks (1–5) | **5** | 4 | 3 |
| Ability to verify claims against code (1–5) | 3 | 2 | **5** |
| Completeness: could the judge tell nothing was skipped? (1–5) | 3 | 1 | **5** |
| Judge's confidence in its merge decision (1–5) | 4–5 | 3 | **5** |
| Judge's ranking | 2nd | 3rd | **1st** |
| Wall time | 112 s | **63 s** | 69 s |

## What this says

- **Finding bugs is the model's job, not the skill's.** All three conditions found all four planted bugs. No skill
  makes the model smarter, and claiming otherwise would be dishonest.
- **lucid wins on trust in a review.** It was the only page where the judge could check every claim against the actual
  changed lines and prove nothing was skipped ("3/3 changes explained", with the hunk totals adding up to the diff
  stat). For AI-written code, which is Arpit's problem, that is the point: a confident page proves nothing unless you
  can see the code under each claim.
- **lucid wins on explaining, narrowly.** It ranked first for the DNS page, close to answer-me-with-html. Its edge was
  the diagrams and their completeness: cache flow, message sequence, delegation tree, a TTL table and a quiz.
- **It is about 2× faster than writing HTML by hand.** answer-me-with-html is faster still (its pages are smaller);
  lucid spends the difference on the visual check and on reading code.
- **The judges saw static screenshots.** Step-through diagrams, hover previews, the tour and the video were never
  exercised, so lucid's interactive features are not in these scores.

## Problems the benchmark found in lucid, all fixed after the run

| Problem | Seen by | Fix |
|---|---|---|
| A table cell "No such name" rendered as "✗ such name" | explain judge | only lowercase `ok` / `no` / `warn` become badges |
| An empty grey cell in a key-value grid | explain judge | the grid draws borders per cell |
| Long code lines cut off at the right edge | review judge | code wraps with a hanging indent; nothing hides off-screen |
| No severity above "high": a data leak ranked the same as an off-by-one | review judge | new `critical` level |
| Base commit printed twice in the header | review judge | printed once |
| Small sequence-diagram labels in a half-width card | explain judge | sequences, LR flows, code and diffs take the full row |
| A glossary placed first delayed the overview | explain judge | SKILL.md now puts the glossary last |

## Not measured yet

- Several runs per cell, so differences can be told apart from noise.
- Real people instead of model judges.
- The interactive features: whether step-through and hover previews speed up understanding.
- Output tokens and cost per answer. The agent harness reported only total tokens, which were within 15% of each other
  across all six runs (60k–68k, mostly shared context).
