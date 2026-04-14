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

// Import the wasm-only entry, not the default, to keep Vite from bundling
// the 25MB WebGPU/JSEP variant we don't use (INT8 runs on wasm only).
import * as ort from 'onnxruntime-web/wasm';

import { extractLogMelFeatures } from '../utils/logmel.js';
import { buildVocab, greedyArgmax, ctcCollapse, decodeMetaspace } from '../utils/ctcDecode.js';

// Let Vite handle wasm asset resolution — the 'onnxruntime-web/wasm'
// import pulls in a hashed .wasm that Vite emits to /assets/ and bakes
// the correct URL into the worker bundle. No wasmPaths override needed.
//
// We're already running inside a worker, so disable ORT's internal
// "proxy worker" — that nested-worker layer is ESM-only and breaks when
// bundled into a classic IIFE parent worker (manifests as 8 stub fetches).
ort.env.wasm.proxy = false;
ort.env.wasm.numThreads = Math.max(1, Math.min(8, self.navigator?.hardwareConcurrency || 4));
ort.env.wasm.simd = true;

const MODEL_URL = '/models/medasr_int8.onnx';
const MEL_URL = '/models/mel_filters.json';
const TOKENIZER_URL = '/models/tokenizer.json';

let session = null;
let melFilters = null;
let vocab = null;
let initPromise = null;

function post(msg) { self.postMessage(msg); }

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} failed: ${r.status}`);
  return r.json();
}

async function fetchModelWithProgress(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} failed: ${r.status}`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !total) {
    // Fall back to plain arrayBuffer if server didn't send content-length
    // or ReadableStream is unavailable. No granular progress in that case.
    post({ type: 'progress', stage: 'model', pct: 0, loaded: 0, total: 0 });
    const buf = await r.arrayBuffer();
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
    post({ type: 'progress', stage: 'tokenizer', pct: 0 });

    const [melJson, tokJson] = await Promise.all([
      fetchJson(MEL_URL),
      fetchJson(TOKENIZER_URL),
    ]);
    melFilters = new Float64Array(melJson.data);
    vocab = buildVocab(tokJson);
    post({ type: 'progress', stage: 'tokenizer', pct: 100 });

    // Stream-fetch the 102MB onnx ourselves for real byte-level progress.
    // Passing the completed buffer to InferenceSession.create bypasses ORT's
    // internal fetch (which gives us no progress hooks).
    const modelBytes = await fetchModelWithProgress(MODEL_URL);

    post({ type: 'progress', stage: 'compile', pct: 0 });
    session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    post({ type: 'progress', stage: 'compile', pct: 100 });
    post({ type: 'ready' });
  })();
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

self.onmessage = async (e) => {
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
