// Unit tests for ctcDecode.js against the real tokenizer.json.
//
// Run with:
//   cd H:/SECND/script/frontend
//   node src/utils/__tests__/ctcDecode.test.mjs
//
// Tests:
//   1. buildVocab: size, a few known pieces at known indices
//   2. ctcCollapse: edge cases (blanks, duplicates, empty)
//   3. Metaspace decode round-trip on a hand-built id sequence
//   4. End-to-end: if reference_pred_ids.json exists, decode it and
//      compare against the expected transcript string.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildVocab,
  ctcCollapse,
  decodeMetaspace,
  decodeLogits,
  greedyArgmax,
} from '../ctcDecode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOK_PATH = resolve(__dirname, '../../../public/models/tokenizer.json');
const PRED_PATH = resolve(__dirname, 'reference_pred_ids.json');

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ok  ${msg}`);
  } else {
    fail++;
    console.error(`  FAIL  ${msg}`);
  }
}

function assertEq(actual, expected, msg) {
  const ok = actual === expected;
  if (ok) {
    pass++;
    console.log(`  ok  ${msg}`);
  } else {
    fail++;
    console.error(`  FAIL  ${msg}`);
    console.error(`        actual:   ${JSON.stringify(actual)}`);
    console.error(`        expected: ${JSON.stringify(expected)}`);
  }
}

// ── 1. buildVocab ────────────────────────────────────────────────
console.log('\n[1] buildVocab');
const tok = JSON.parse(readFileSync(TOK_PATH, 'utf8'));
const vocab = buildVocab(tok);
assertEq(vocab.length, 512, 'vocab length is 512');
assertEq(vocab[0], '<epsilon>', 'vocab[0] is <epsilon>');
assertEq(vocab[1], '<s>', 'vocab[1] is <s>');
assertEq(vocab[2], '</s>', 'vocab[2] is </s>');
assertEq(vocab[3], '<unk>', 'vocab[3] is <unk>');
assertEq(vocab[4], '\u2581', 'vocab[4] is the metaspace char');
assertEq(vocab[5], 's', 'vocab[5] is s');
assertEq(vocab[6], ',', 'vocab[6] is ,');

// ── 2. ctcCollapse ───────────────────────────────────────────────
console.log('\n[2] ctcCollapse');
assertEq(JSON.stringify(ctcCollapse([])), '[]', 'empty');
assertEq(JSON.stringify(ctcCollapse([0, 0, 0])), '[]', 'all blank');
assertEq(JSON.stringify(ctcCollapse([5, 5, 5, 7, 7, 3])), '[5,7,3]', 'plain dup collapse');
assertEq(JSON.stringify(ctcCollapse([5, 0, 5])), '[5,5]', 'blank between dups keeps both');
assertEq(JSON.stringify(ctcCollapse([0, 5, 0, 0, 7, 7, 0])), '[5,7]', 'mixed blanks and dups');
assertEq(JSON.stringify(ctcCollapse([4, 5, 6, 7])), '[4,5,6,7]', 'no collapsing needed');

// ── 3. Metaspace decode ──────────────────────────────────────────
console.log('\n[3] decodeMetaspace (hand-built sequence)');
// Build "hello world" manually:
// We need piece ids for: ▁hello ▁world  -- or any decomposition.
// Find the ids for ▁ (id 4), h, e, l, o, space-h lookups...
// Simpler: construct "▁CT" by concatenating ▁ + C + T using whatever ids exist.
const findId = (piece) => vocab.indexOf(piece);
const ms = findId('\u2581');
assert(ms === 4, `▁ id is 4 (got ${ms})`);
// Look up some known letters
const idC = findId('C');
const idT = findId('T');
assert(idC > 3, `'C' exists in vocab (id ${idC})`);
assert(idT > 3, `'T' exists in vocab (id ${idT})`);

if (idC > 3 && idT > 3) {
  const ids = [ms, idC, idT]; // ▁ C T
  const text = decodeMetaspace(ids, vocab);
  assertEq(text, 'CT', 'decodeMetaspace(▁ + C + T) -> "CT"');
}

// Skip special tokens
const textSkip = decodeMetaspace([0, 1, 2, 3, ms, idC, idT, 0, 0], vocab);
assertEq(textSkip, 'CT', 'special tokens are skipped');

// Multi-word via two metaspace prefixes
if (idC > 3 && idT > 3) {
  const idS = findId('s');
  if (idS > 3) {
    const ids = [ms, idC, idT, ms, idS]; // ▁CT ▁s
    const text = decodeMetaspace(ids, vocab);
    assertEq(text, 'CT s', 'two metaspace prefixes -> word split');
  }
}

// ── 4. End-to-end (optional, needs dumped ids) ───────────────────
console.log('\n[4] end-to-end decode from dumped pred_ids');
if (!existsSync(PRED_PATH)) {
  console.log(`  skipped: ${PRED_PATH} not present`);
  console.log(`  (run 05_dump_reference_pred_ids.py on the vast pod to enable)`);
} else {
  const ref = JSON.parse(readFileSync(PRED_PATH, 'utf8'));
  console.log(`  loaded ${ref.pred_ids.length} pred ids`);
  console.log(`  expected transcript: ${JSON.stringify(ref.transcript.slice(0, 80))}...`);

  const collapsed = ctcCollapse(ref.pred_ids);
  const text = decodeMetaspace(collapsed, vocab);

  // Python's processor.batch_decode leaves </s> in the output by default.
  // We intentionally strip it (not useful in a clinician chat UI), so
  // normalize the reference before comparing.
  const expected = ref.transcript.replace(/<\/s>\s*$/, '');

  console.log(`  got transcript:      ${JSON.stringify(text.slice(0, 80))}...`);
  assertEq(text, expected, 'full decode matches Python output (minus </s>)');
}

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
