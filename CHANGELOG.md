# Changelog

## 0.1.0 — 2026-10-05

First public release.

- **Explain mode:** editorial pages with the answer as the headline; `architecture` (tiers of typed components with icons,
  labelled connections routed around cards, step-through playback); `flow`, `sequence`, `tree`, `timeline`, `chart`,
  `waffle`, `cases`, `kv`, `callout`, `glossary`, `quiz`, `checklist`; bespoke interactive `figure` blocks with a small kit
  (player, steps, before/after, toggle, slider, readouts).
- **Review mode:** `clearproof diff` hunk index over committed, uncommitted and untracked work; `diff` blocks with line
  notes; `changemap`; `risks`; `claims`; coverage meter and an all-changes appendix.
- **Proof:** `run` blocks execute real commands at render time; code references are read from disk or git, never retyped.
- **Self-check:** `--check` renders at 1280 px and 390 px, reports layout faults, and saves screenshots plus one sheet of
  every figure for the agent's critique pass.
- **Plain-English lint** inspired by ASD-STE100; a number inventory that flags one quantity with two values.
- **Video:** `clearproof video` records the page tour to MP4 with the computer's own voice (`say` on macOS, `espeak` on Linux) or captions only.
