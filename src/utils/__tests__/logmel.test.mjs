// Numerical parity test: extractLogMelFeatures vs Python LasrFeatureExtractor.
//
// Run with:
//   cd H:/SECND/script/frontend
//   node src/utils/__tests__/logmel.test.mjs
//
// Requires:
//   - src/utils/__tests__/reference_features.json  (gitignored; dumped by
//     docs/medasr_onnx/04_dump_reference_features.py on the vast pod)
//   - public/models/mel_filters.json
//
// Pass criterion: max abs diff < 5e-4 on all 4378*128 = 560,384 elements.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractLogMelFeatures } from '../logmel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_PATH = resolve(__dirname, 'reference_features.json');
const MEL_PATH = resolve(__dirname, '../../../public/models/mel_filters.json');

console.log('Loading reference ...');
const ref = JSON.parse(readFileSync(REF_PATH, 'utf8'));
console.log(`  audio: ${ref.audio_samples} samples @ ${ref.sample_rate}Hz`);
console.log(`  input_features: shape=${JSON.stringify(ref.input_features.shape)}`);

console.log('Loading mel filterbank ...');
const melJson = JSON.parse(readFileSync(MEL_PATH, 'utf8'));
console.log(`  mel_filters: shape=${JSON.stringify(melJson.shape)}`);
const melFilters = new Float64Array(melJson.data);

console.log('Preparing audio ...');
const audio = new Float32Array(ref.audio);
console.log(`  audio buffer: ${audio.length} samples`);

console.log('Running JS extractor ...');
const t0 = Date.now();
const { features, shape, mask } = extractLogMelFeatures(audio, melFilters);
const elapsed = Date.now() - t0;
console.log(`  JS output: shape=[${shape}] mask.length=${mask.length}  (${elapsed}ms)`);

// Shape check
const [refT, refM] = ref.input_features.shape.slice(1);
if (shape[0] !== refT || shape[1] !== refM) {
  console.error(`FAIL: shape mismatch — js=[${shape}] py=[${refT}, ${refM}]`);
  process.exit(1);
}

const refFlat = ref.input_features.data;
if (refFlat.length !== features.length) {
  console.error(`FAIL: flat length mismatch — js=${features.length} py=${refFlat.length}`);
  process.exit(1);
}

console.log('Comparing element-wise ...');
let maxAbs = 0;
let sumAbs = 0;
let maxIdx = -1;
let firstBadIdx = -1;
const TOL_STRICT = 5e-4;
for (let i = 0; i < features.length; i++) {
  const d = Math.abs(features[i] - refFlat[i]);
  sumAbs += d;
  if (d > maxAbs) {
    maxAbs = d;
    maxIdx = i;
  }
  if (d > TOL_STRICT && firstBadIdx < 0) firstBadIdx = i;
}
const meanAbs = sumAbs / features.length;

console.log(`\n=== Results ===`);
console.log(`  max abs diff:  ${maxAbs.toExponential(3)}`);
console.log(`  mean abs diff: ${meanAbs.toExponential(3)}`);
console.log(`  max at flat idx ${maxIdx} (frame=${(maxIdx / 128) | 0}, mel=${maxIdx % 128})`);
console.log(`  js val:  ${features[maxIdx]}`);
console.log(`  py val:  ${refFlat[maxIdx]}`);

// Eyeball first frame for sanity
console.log(`\nfirst_frame[:5]  js: ${Array.from(features.slice(0, 5)).map(x => x.toFixed(6))}`);
console.log(`first_frame[:5]  py: ${refFlat.slice(0, 5).map(x => x.toFixed(6))}`);

const lastBase = (refT - 1) * refM;
console.log(`\nlast_frame[:5]   js: ${Array.from(features.slice(lastBase, lastBase + 5)).map(x => x.toFixed(6))}`);
console.log(`last_frame[:5]   py: ${refFlat.slice(lastBase, lastBase + 5).map(x => x.toFixed(6))}`);

if (maxAbs < TOL_STRICT) {
  console.log(`\nPASS (max diff ${maxAbs.toExponential(3)} < ${TOL_STRICT})`);
  process.exit(0);
} else {
  console.log(`\nFAIL (max diff ${maxAbs.toExponential(3)} >= ${TOL_STRICT})`);
  console.log(`first failure at flat idx ${firstBadIdx}`);
  process.exit(1);
}
