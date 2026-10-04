import flow from './flow.mjs';
import sequence from './sequence.mjs';
import tree from './tree.mjs';
import timeline from './timeline.mjs';
import chart from './chart.mjs';
import callout from './callout.mjs';
import kv from './kv.mjs';
import code from './code.mjs';
import quiz from './quiz.mjs';
import checklist from './checklist.mjs';
import glossary from './glossary.mjs';
import diff from './diff.mjs';
import changemap from './changemap.mjs';
import risks from './risks.mjs';
import run from './run.mjs';
import claims from './claims.mjs';

export const COMPONENTS = new Map([flow, sequence, tree, timeline, chart, callout, kv, code, glossary, quiz, checklist, diff, changemap, risks, run, claims].map((c) => [c.name, c]));
export const RAW = new Set(['html', 'svg']);
