<div align="center">

# clearproof

### Clear visuals, proven answers

**An agent skill for Claude Code, Codex and Cursor that turns AI answers and AI-written code changes into interactive
HTML pages: step-through diagrams, real code, executed proof, and a verdict-first code review.**

[![CI](https://github.com/Inspire-Labs-AI/html-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/Inspire-Labs-AI/html-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js 20+](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
![Claude Code skill](https://img.shields.io/badge/Claude%20Code-skill-8A63D2.svg)

[Quick start](#quick-start) · [Examples](#what-it-makes) · [How it works](#how-it-works) · [Benchmark](#benchmark) ·
[FAQ](#faq)

<img src="docs/images/explain-gc.png" alt="clearproof explainer page: the answer as the headline, then a step-through diagram of garbage-collection marking" width="820">

</div>

---

Reading is now the bottleneck. An AI agent writes 400 lines of code or a 2,000-word answer in a minute, and a person
needs half an hour to understand it and decide whether to trust it. **clearproof** makes that output understandable:

- **Explain anything** — a concept, a system, a codebase, a money decision — as one offline HTML page whose spine is
  figures: diagrams you step through, sliders you drag, charts drawn from real numbers.
- **Review AI-written code** — a branch, a PR, or uncommitted agent work — as a page that leads with the verdict and the
  risks, reproduces each bug by running the real code, and proves it covered **every changed hunk**.
- **Prove every claim** — code is read from disk or git, never retyped; numbers come from commands run while the page
  is built; every claim is marked verified, inferred or unverified.

In blind, screenshot-only tests against plain "answer in HTML", [answer-me-with-html](https://github.com/QingYunA/answer-me-with-html)
and [visual-explainer](https://github.com/nicobailon/visual-explainer), clearproof scored highest on explainers and
**ranked first in every code-review judgment**. ([Results](#benchmark))

## Quick start

**Claude Code** (plugin):

```text
/plugin marketplace add Inspire-Labs-AI/html-skill
/plugin install clearproof@clearproof
```

**Codex, Cursor, OpenCode or any agent with skills:** copy the skill folder.

```bash
git clone https://github.com/Inspire-Labs-AI/html-skill.git
cp -R html-skill/skills/clearproof ~/.claude/skills/clearproof   # or your agent's skills folder
```

It needs **Node.js 20 or later**, which most machines with Claude Code already have. That is the whole setup: no
configuration, no API keys. Then ask in plain words. The skill also starts on its own when
an answer needs a page.

```text
> Explain how garbage collection pauses work. Make a page.
> An agent wrote this branch. Help me understand it — is it safe to merge?
> Walk me through how authentication works in this repo.
> Should I prepay my home loan? ₹50 lakh at 8.5%, 20 years. Show real numbers.
> Make a narrated video of that page.
```

Claude replies with one HTML file. Open it in any browser. [How it works](#how-it-works) explains what happens in
between.

## What it makes

Every page below was made by an agent using only this skill. Open the HTML files in a browser to step through the
diagrams and drag the sliders.

| | |
|---|---|
| **Explainer: garbage collection** · [page](docs/examples/garbage-collection.html) · [draft](examples/garbage-collection.md)<br>A live figure: drag the live-data slider or switch collector, and the pause redraws.<br><img src="docs/images/explain-gc-live.png" alt="Interactive figure: GC pause length versus live data for three collector designs" width="420"> | **Code review of an AI-written change**<br>Verdict first, risks ranked, "4/4 changes explained", and a ledger of what was checked.<br><img src="docs/images/review-verdict.png" alt="clearproof code review page: do-not-merge verdict, coverage meter and ranked risks" width="420"> |
| **Proof, not opinion**<br>Each bug is reproduced by running the real code; the output is captured while the page is built.<br><img src="docs/images/review-proof.png" alt="Run blocks showing real command output that reproduces each bug" width="420"> | **Not only code: home-loan prepayment** · [page](docs/examples/home-loan.html) · [draft](examples/home-loan.md)<br>Every number comes from a [calculator](examples/home-loan/loan.mjs) run at build time.<br><img src="docs/images/loan.png" alt="Home-loan explainer with the saving as the headline and a yearly interest chart" width="420"> |

More pages:

- [ASD-STE100 (Simplified Technical English) explained](docs/examples/ste100.html) — the aerospace writing standard
  Andrej Karpathy suggested for reading model output, with measured before/after rewrites of an LLM answer and a prompt.
- [How TCP opens and closes a connection](docs/examples/tcp.html) — sequence diagrams that play step by step.
- [The clearproof method](docs/methodology.html) and [how we built clearproof](docs/how-we-built-clearproof.html) —
  both made with clearproof.

## Why

Two observations, one tool.

- **Andrej Karpathy:** we will spend more and more of our time *understanding* model output. Move it up a ladder:
  controlled plain English ([ASD-STE100](docs/examples/ste100.html)), then diagrams, then interactive HTML, then
  narrated explainer videos.
- **Arpit Bhayani:** human attention is not built for *zero-context scrutiny*, yet that is exactly what reviewing
  AI-generated code asks for. Code review has to become **code understanding**.

clearproof applies Karpathy's ladder to both jobs: answers and code changes. The full reasoning is in
[docs/design.md](docs/design.md).

## How it works

You ask a question or ask for a review. Behind the scenes, five things happen:

1. **Plan.** Claude decides the one sentence you must leave with and makes it the page's headline. For a review, the
   headline is the verdict: merge, fix first, or block.
2. **Write a short draft.** Claude writes a few pages of plain text that describe the diagrams, charts and sections.
   It never retypes your code: it points at the real lines, and clearproof copies them from your files.
3. **Build the page.** clearproof turns the draft into one HTML file: it lays out the diagrams, draws the charts, adds
   the step-through controls, and runs the small commands that prove each number or bug.
4. **Check the page.** clearproof opens the page in a browser at laptop and phone size and reports anything broken:
   overlapping labels, cut-off tables, unreadable text, or the same number written two ways.
5. **Look and fix.** Claude looks at screenshots of its own page, fixes the weakest parts once, and gives you the file.

You get one HTML file that works offline. Open it in any browser and share it like any other file.

## Features

**Explain mode**

- **Figures that show the mechanism:** `flow` and `sequence` diagrams with an automatic layered layout that **play step
  by step**; bespoke interactive `figure` blocks with a small kit (player, steps, before/after, toggle, slider,
  readouts).
- **Numbers with pictures:** `chart` (bar, line, log scale, highlighted bar, in-place notes), `waffle`, `cases` (small
  multiples), `tree`, `timeline`, `kv`.
- **Editorial layout:** the answer as the headline, a lead, claim headings, numbered figure captions.
- **Understanding checks:** `quiz` with an explanation for every option, `glossary` hover definitions, `checklist`.

**Review mode** (code understanding)

- Reads your committed, uncommitted **and untracked** work, so nothing an agent changed is missed.
- `diff` blocks show the real hunk with notes pinned to the lines that matter; `changemap` shows the shape of the
  change; `risks` ranks critical → low with *why*, *trigger* and *fix*.
- A coverage meter — **"4/4 changes explained"** — and an *All changes* appendix flag anything the walkthrough skipped.

**For both**

- **Executed proof:** real commands run while the page is built, and every claim is marked verified, inferred or unverified.
- **Self-check:** `--check` renders the page in headless Chromium at desktop and phone width and reports overflow,
  cut-off tables, overlapping labels, tiny text and runtime errors.
- **Plain-English lint** inspired by ASD-STE100: sentence length, passive voice, wordy words, and a number inventory that
  flags one quantity with two values.
- **Narrated video:** ask for a video of any page and get an MP4 walkthrough.
- **One offline file:** no CDN, no tracking; the page embeds its own draft.

## Benchmark

Blind, screenshot-judged rounds with the same model under every condition and a **new topic every round**. Judges saw
only shuffled screenshots and answered fixed comprehension questions written before any page existed.
[Full method, every round, and the harness fixes](docs/benchmark.md).

| Latest explainer round (vector databases) | clearproof | plain HTML | answer-me-with-html |
|---|---|---|---|
| Blind score, out of 20 (two runs) | **18, 17** | 17, 17 | 14, 11 |
| Tokens per page (average) | 0.66 M | 0.53 M | 0.60 M |
| Time per page (average) | 4.1 min | 2.8 min | 1.1 min |

| Code reviews of AI-written branches (all rounds) | clearproof | plain HTML | visual-explainer | answer-me-with-html |
|---|---|---|---|---|
| Rank in each judgment | **1st every time** | 2nd | 3rd | 3rd–4th |

clearproof was the only condition whose pages let judges **verify** each claim (5/5) and confirm that **nothing was
skipped** (5/5). Every condition found the planted bugs; the difference is whether a reviewer can check the findings.

**Limits:** model judges rather than people, two runs per condition, and static screenshots, so sliders, steppers and
videos were not scored.

## How it compares

| | clearproof | answer-me-with-html | visual-explainer | plain "answer in HTML" |
|---|---|---|---|---|
| Model writes a short draft, CLI writes the HTML | ✅ | ✅ | ❌ hand-written HTML | ❌ hand-written HTML |
| Step-through diagrams and live figures | ✅ | ❌ static | ✅ | varies |
| Code read from disk or git, never retyped | ✅ | ❌ | ❌ | ❌ |
| Numbers from commands run at build time | ✅ | ❌ | ❌ | ❌ |
| Review mode with every changed hunk accounted for | ✅ | ❌ | partial | ❌ |
| Layout check in a real browser before delivery | ✅ | ❌ | ❌ | ❌ |
| Narrated video export | ✅ | ❌ | ❌ | ❌ |

## FAQ

**What is clearproof?**
An open-source agent skill that turns an AI answer or an AI-written code change into one interactive, self-contained
HTML page that a person understands fast and can verify.

**Which agents does it work with?**
Claude Code (as a plugin or a skill), and any agent that loads skills from a folder, such as Codex, Cursor and OpenCode.
The CLI also runs on its own with Node.js 20+.

**Is it only for code?**
No. It explains concepts, systems and decisions in any field. For money, science or statistics, the agent writes a
small script, runs it, and quotes its output, so the numbers on the page are computed, not guessed.

**How is it different from answer-me-with-html?**
Both let the model write a short draft that a CLI turns into HTML. clearproof adds figures that show the mechanism,
code read from the repository, numbers from executed commands, a code-review mode, and a browser check before delivery.
In blind tests it scored 17.5 of 20 on average against 12.5.

**What is ASD-STE100, and why does it matter here?**
ASD-STE100 Simplified Technical English is the controlled-English standard for aerospace maintenance manuals: 53
writing rules and a dictionary of about 900 approved words. Andrej Karpathy suggested it for reading LLM output.
clearproof's prose lint applies its core ideas. [Read the explainer](docs/examples/ste100.html).

**Do I need to configure anything?**
No. Install the plugin and ask. Claude runs everything else for you.

**Does it send my code anywhere?**
No. Pages are built and checked on your machine, and the page itself is one offline file.

**How much does a page cost?**
In the latest benchmark, about 0.66 M tokens and 4 minutes per explainer, close to asking for plain HTML (0.53 M).

## Project structure

```text
skills/clearproof/        the skill: SKILL.md + zero-dependency CLI (scripts/)
examples/                 drafts you can render, including a demo review repository script
docs/                     rendered example pages, screenshots, benchmark and design notes
test/                     node --test suite (npm test)
.claude-plugin/           Claude Code plugin and marketplace manifests
```

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md); run `npm test` before you open a pull
request.

## Acknowledgements

- [Andrej Karpathy](https://x.com/karpathy) for the ladder from plain English to explainer video.
- [Arpit Bhayani](https://x.com/arpit_bhayani) for framing code review as code understanding.
- [answer-me-with-html](https://github.com/QingYunA/answer-me-with-html) for the draft-plus-CLI idea, and
  [visual-explainer](https://github.com/nicobailon/visual-explainer) for raising the bar on figures.

## License

[MIT](LICENSE) © Inspire Labs AI
