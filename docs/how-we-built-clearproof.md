---
kicker: How we built clearproof
title: clearproof scores 17.5 of 20 where answer-me-with-html scores 12.5, for 10% more tokens
tldr: Both skills turn a short model-written draft into HTML. clearproof adds **proof, figures and a self-check**, and blind tests on a new topic each round measured the gap.
for: the team deciding whether to use clearproof, and anyone who wants to check our numbers
---

## The hero {hero}
```chart bar unit=points caption="Round 5, blind scores out of 20 on the same vector-database question. clearproof leads both runs; answer-me-with-html trails both."
series: run 1, run 2
*clearproof | 18, 17 ! highest in both runs
plain HTML | 17, 17
answer-me-with-html | 14, 11
```

```run
$ sed -n '32p' BENCHMARK.md
shows: 18, 17
note: The chart copies this row of the benchmark record (columns: plain HTML, answer-me-with-html, clearproof before the token fix, clearproof now).
```

## We kept the one idea answer-me-with-html got right {kicker="Origin"}
answer-me-with-html had the right core idea: the model writes a short draft, and a CLI writes the HTML. That cuts tokens, because the model never types CSS or SVG. We kept that idea and added what Andrej Karpathy and Arpit Bhayani asked for: pictures that show the mechanism, and pages a reviewer can trust.

```flow LR caption="One pipeline for both modes. The model writes words; the CLI draws, runs code and checks the page."
(Question or diff) -> Draft: model writes | The model writes a short Markdown draft. It points at code; it never retypes it.
Draft -> *CLI: render | The CLI lays out diagrams, reads real code from disk or git, and runs commands for real numbers.
*CLI -> Check: Chromium | It opens the page at desktop and phone width and reports overlaps, cut-off text and runtime errors.
Check -> Critique: one sheet | The model reads every figure on one sheet and fixes its 3 weakest points, once.
Critique -> (Page)
```

## Each round of tests decided the next change {kicker="How we built it"}
We did not tune by taste. Every change answered a judge's complaint from the round before.

```timeline
Round 1 | Reviews first | Bug-finding was equal; judges could not check claims. Added real diff hunks, run blocks and "N/N changes explained".
Round 2 | Explainers lost | Judges wanted pictures of the mechanism. Added record nodes with real data, charts checked against run output.
Round 3 | Still 3rd on explainers | The leaders hand-drew interactive figures. Added the figure kit: stepper, slider, before/after.
Round 4 | Joint first | Added the editorial layout, numbered captions and a judge-style critique pass. Averaged 18.0 of 20.
Round 5 | Cost | Quality held, but 1.49 M tokens per page. A step budget cut it to 0.66 M.
```

## Why clearproof is better: it proves, not just shows {kicker="Comparison"}
Both skills are fast at the draft. The difference is what happens to the claims on the page.

| Need | answer-me-with-html | clearproof |
|---|---|---|
| Right numbers | no typed | ok run real code |
| Real code | no retyped | ok read by line |
| Mechanism | warn static boxes | ok steppers, sliders |
| Review mode | no none | ok every hunk counted |
| Self-check | no none | ok Chromium + critique |

```chart bar unit=M tokens caption="Tokens per page, round 5. After the step budget, clearproof costs 0.06 M more than answer-me-with-html."
plain HTML | 0.53
answer-me-with-html | 0.60
*clearproof now | 0.66 ! 10% more than answer-me-with-html
clearproof before | 1.49
```

```run
$ sed -n '30p' BENCHMARK.md
shows: 0.66
note: Average tokens per page, from the benchmark record.
```

In code review the gap is larger. clearproof ranked first in every review judgment, in every round.

```run
$ grep -E "^\| (1|2, set 1|2, set 2|4) \| (orders|password)" BENCHMARK.md
shows: **1st**
note: Review rankings per round. Columns: clearproof, plain HTML, visual-explainer, answer-me-with-html.
```

## How one test round works {kicker="Method"}
Each round uses fresh agents and fresh judges. Nobody sees which skill made which page.

```flow caption="The judge never learns which skill made a page until the scores are in."
(Quiz + answer key) -> Producers: same prompt | We write the quiz and the answer key before any page exists.
Producers -> Pages: 2 runs each | Fresh agents with no context get the same question. Only the skill differs.
Pages -> Tiler: scrolls | A script scrolls each page and saves screen-sized screenshots.
Tiler -> Shuffle: new labels | A script shuffles the labels and hides the key from the judges.
Shuffle -> *Judges: screenshots | Fresh judges answer the quiz from each page and score Clarity, Visuals, Readability, Trust.
*Judges -> (Decode key)
```

## Why the tests are fair {kicker="Fairness"}
We looked for every way the test could favour clearproof, and closed it.

- **We tune on the test topic** → a new topic every round: DNS, indexes, CPU caches, GC, vector search.
- **The judge knows our page** → shuffled labels; the key stays hidden until scoring ends.
- **Our prompt is better** → one prompt template for all; only the skill file changes.
- **A page loses for capture reasons** → we fixed harness bugs that hurt rivals (scroll-revealed content) and us (smooth scrolling), then judged again.
- **A rival run broke** → we ran the answer-me-with-html runs that deleted pages again, in separate folders.
- **We move the goalposts** → we fix the quiz and answer key before any run, and we report the rounds we lost.

```claims
verified | clearproof scored 18 and 17 against 14 and 11 for answer-me-with-html in round 5. | run
verified | clearproof ranked first in every review judgment. | run
verified | clearproof now uses 0.66 M tokens per page against 0.60 M for answer-me-with-html. | run
inferred | The lead comes from proof and figures, not from length. | Judges cited measured numbers and stepped figures; they were told not to reward length.
unverified | The ranking holds for human readers. | No human study yet.
```

```callout warn What the tests cannot tell you
Judges were models, not people, with 2 runs per condition. They saw static screenshots, so sliders, steppers and videos were not scored. Read the result as "clearly ahead in these conditions", not as a law.
```

## Check yourself
```quiz
? Why did clearproof's token cost fall from 1.49 M to 0.66 M?
- [x] It takes fewer agent steps :: Yes. Each step re-reads the whole conversation, so steps drive the cost, not words.
- [ ] It writes shorter pages :: The draft was about the same size before and after.
- [ ] It uses a smaller model :: Every condition used the same model.
? A rival page scored low because its content appeared only on scroll. What did we do?
- [x] Fixed the capture to scroll like a reader, and judged again :: Yes. A test must not punish a page for how we capture it.
- [ ] Kept the score :: That would make the test unfair to the rival.
- [ ] Dropped the rival :: Dropping a rival hides a comparison instead of fixing it.
```

## Sources
- [BENCHMARK.md](../BENCHMARK.md) — every round, score and harness fix
- [PLAN.md](../PLAN.md) — the thesis from Karpathy's tweet and Arpit Bhayani's post
- [answer-me-with-html](https://github.com/QingYunA/answer-me-with-html) — the skill we compared against
