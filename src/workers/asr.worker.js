// MedASR inference worker.
//
// Owns the entire speech-to-text path so the main thread stays responsive:
//   1. Receive mono Float32Array @ 16kHz
//   2. Extract log-mel features (src/utils/logmel.js)
//   3. Run onnxruntime-web INT8 session on medasr_int8.onnx
//   4. Greedy argmax -> CTC collapse -> Metaspace decode (src/utils/ctcDecode.js)
//   5. Post the final text back
//
// Protocol (main -> worker):
//   { type: 'init' }                     (optional; lazy-loads on first transcribe)
//   { type: 'transcribe', audio }        audio: Float32Array @ 16000Hz mono
//
// Protocol (worker -> main):
//   { type: 'ready' }
//   { type: 'progress', stage, pct }     stage ∈ {loading, features, inference, decode}
//   { type: 'result', text, timings }
//   { type: 'error', message }

// If this script is loaded as an Emscripten pthread helper, do not run
// our app-level code — ORT's own pthread handler (inside the imported
// module) takes over. Without this guard, our top-level onmessage handler
// would hijack pthread messaging and deadlock InferenceSession.create.
const IS_EM_PTHREAD = typeof self !== 'undefined' && self.name === 'em-pthread';

// Import the wasm-only entry, not the default, to keep Vite from bundling
// the 25MB WebGPU/JSEP variant we don't use (INT8 runs on wasm only).
import * as ort from 'onnxruntime-web/wasm';

import { extractLogMelFeatures } from '../utils/logmel.js';
import { buildVocab, greedyArgmax, ctcCollapse, decodeMetaspace } from '../utils/ctcDecode.js';

// Let Vite handle wasm asset resolution — the 'onnxruntime-web/wasm'
// import pulls in a hashed .wasm that Vite emits to /assets/ and bakes
// the correct URL into the worker bundle. No wasmPaths override needed.
//
// Single-threaded WASM only. Multi-threaded WASM spawns pthread workers
// by re-loading this same script, which re-runs our top-level init and
// hijacks onmessage in every pthread context. That manifested as "worker
// booted" firing N times and InferenceSession.create hanging forever.
//
// The speedup from threads=8 vs threads=1 on 5s clips is ~2-3x, not worth
// the bundling complexity. Inference still completes in 1-3s single-threaded.
ort.env.wasm.proxy = false;
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

const MODEL_URL = '/models/medasr_int8.onnx';
const MEL_URL = '/models/mel_filters.json';
const TOKENIZER_URL = '/models/tokenizer.json';

let session = null;
let melFilters = null;
let vocab = null;
let initPromise = null;

function post(msg) { self.postMessage(msg); }

function log(...args) {
  try { console.log('[asr.worker]', ...args); } catch {}
  try { self.postMessage({ type: 'log', level: 'info', args: args.map(a => {
    if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack}`;
    if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
    return String(a);
  })}); } catch {}
}
function logErr(...args) {
  try { console.error('[asr.worker]', ...args); } catch {}
  try { self.postMessage({ type: 'log', level: 'error', args: args.map(a => {
    if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack}`;
    if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
    return String(a);
  })}); } catch {}
}

if (!IS_EM_PTHREAD) {
  log('worker booted. ort version:', ort.env?.versions?.common || '?',
      'numThreads:', ort.env.wasm.numThreads,
      'simd:', ort.env.wasm.simd,
      'proxy:', ort.env.wasm.proxy);
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} failed: ${r.status}`);
  return r.json();
}

async function fetchModelWithProgress(url) {
  log('fetchModelWithProgress: GET', url);
  const r = await fetch(url);
  log('fetchModelWithProgress: status', r.status, 'content-length',
      r.headers.get('content-length'), 'content-encoding',
      r.headers.get('content-encoding'));
  if (!r.ok) throw new Error(`fetch ${url} failed: ${r.status}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !total) {
    log('fetchModelWithProgress: no body/content-length, fallback to arrayBuffer');
    // Fall back to plain arrayBuffer if server didn't send content-length
    // or ReadableStream is unavailable. No granular progress in that case.
    post({ type: 'progress', stage: 'model', pct: 0, loaded: 0, total: 0 });
    const buf = await r.arrayBuffer();
    log('fetchModelWithProgress: fallback buffer', buf.byteLength, 'bytes');
    post({ type: 'progress', stage: 'model', pct: 100, loaded: buf.byteLength, total: buf.byteLength });
    return new Uint8Array(buf);
  }

  const reader = r.body.getReader();
  const chunks = [];
  let loaded = 0;
  let lastPct = -1;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const pct = Math.floor((loaded / total) * 100);
    if (pct !== lastPct) {
      post({ type: 'progress', stage: 'model', pct, loaded, total });
      lastPct = pct;
    }
  }
  // Concat chunks into one buffer
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function initOnce() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    log('init: start');
    post({ type: 'progress', stage: 'tokenizer', pct: 0 });

    log('init: fetching mel_filters + tokenizer');
    const t0 = performance.now();
    const [melJson, tokJson] = await Promise.all([
      fetchJson(MEL_URL),
      fetchJson(TOKENIZER_URL),
    ]);
    log('init: tokenizer+mel fetched in', Math.round(performance.now() - t0), 'ms');
    melFilters = new Float64Array(melJson.data);
    vocab = buildVocab(tokJson);
    log('init: vocab size', vocab.length, 'mel filters len', melFilters.length);
    post({ type: 'progress', stage: 'tokenizer', pct: 100 });

    log('init: streaming onnx from', MODEL_URL);
    const tFetch = performance.now();
    const modelBytes = await fetchModelWithProgress(MODEL_URL);
    log('init: onnx fetched,', modelBytes.byteLength, 'bytes in',
        Math.round(performance.now() - tFetch), 'ms');

    post({ type: 'progress', stage: 'compile', pct: 0 });
    log('init: calling InferenceSession.create (this is the expensive step) ...');
    const tCompile = performance.now();
    try {
      session = await ort.InferenceSession.create(modelBytes, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
    } catch (err) {
      logErr('InferenceSession.create FAILED:', err);
      throw err;
    }
    log('init: InferenceSession.create OK in',
        Math.round(performance.now() - tCompile), 'ms');
    log('init: input names:', session.inputNames, 'output names:', session.outputNames);
    post({ type: 'progress', stage: 'compile', pct: 100 });
    post({ type: 'ready' });
    log('init: DONE');
  })();
  initPromise.catch((err) => logErr('init failed:', err));
  return initPromise;
}

async function transcribe(audio) {
  if (!(audio instanceof Float32Array)) {
    throw new TypeError('audio must be a Float32Array');
  }
  if (audio.length < 400) {
    return { text: '', timings: { features: 0, inference: 0, decode: 0 } };
  }

  await initOnce();

  post({ type: 'progress', stage: 'features', pct: 0 });
  const tF0 = performance.now();
  const { features, shape, mask } = extractLogMelFeatures(audio, melFilters);
  const tFeatures = performance.now() - tF0;
  if (shape[0] === 0) {
    return { text: '', timings: { features: tFeatures, inference: 0, decode: 0 } };
  }

  post({ type: 'progress', stage: 'inference', pct: 0 });
  const tI0 = performance.now();
  const featTensor = new ort.Tensor('float32', features, [1, shape[0], shape[1]]);
  const maskTensor = new ort.Tensor('bool', mask, [1, shape[0]]);
  const out = await session.run({
    input_features: featTensor,
    attention_mask: maskTensor,
  });
  const logits = out.logits; // Tensor: data Float32Array, dims [1, T_out, V]
  const tInference = performance.now() - tI0;

  post({ type: 'progress', stage: 'decode', pct: 0 });
  const tD0 = performance.now();
  const [, Tout, V] = logits.dims;
  const ids = greedyArgmax(logits.data, Tout, V);
  const collapsed = ctcCollapse(ids);
  const text = decodeMetaspace(collapsed, vocab);
  const tDecode = performance.now() - tD0;

  return {
    text,
    timings: {
      features: Math.round(tFeatures),
      inference: Math.round(tInference),
      decode: Math.round(tDecode),
    },
  };
}

if (!IS_EM_PTHREAD) self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await initOnce();
    } else if (msg.type === 'transcribe') {
      const result = await transcribe(msg.audio);
      post({ type: 'result', ...result });
    } else {
      post({ type: 'error', message: `unknown message type: ${msg.type}` });
    }
  } catch (err) {
    post({ type: 'error', message: err?.message || String(err) });
  }
};
