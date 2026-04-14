// Main-thread adapter for the MedASR worker.
//
// Responsibilities:
//   1. Own a singleton Worker instance (lazy init on first call).
//   2. Decode a Blob (webm/opus from MediaRecorder) -> Float32Array.
//   3. Resample to 16kHz mono via OfflineAudioContext.
//   4. Ship audio to the worker, await result, resolve { text, duration_ms }.
//
// Exported signature deliberately matches utils/api.js chatTranscribe so the
// swap in ChatPage.jsx is a one-line import change.

const TARGET_SAMPLE_RATE = 16000;

let worker = null;
let workerReady = null;      // Promise that resolves when worker posts 'ready'
let pending = null;          // { resolve, reject } for in-flight transcribe
let onProgressCb = null;

function getWorker() {
  if (worker) return worker;

  // Classic worker (no `type: 'module'`) — paired with vite.config.js
  // `worker.format: 'iife'` to produce a single inline bundle. ESM workers
  // break when Vite can't resolve all onnxruntime-web asset imports.
  worker = new Worker(
    new URL('../workers/asr.worker.js', import.meta.url)
  );

  workerReady = new Promise((resolve, reject) => {
    const onMessage = (e) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        worker.removeEventListener('message', onMessage);
        resolve();
      } else if (msg.type === 'error' && !pending) {
        // Error before a transcribe call means init failed
        worker.removeEventListener('message', onMessage);
        reject(new Error(msg.message));
      }
    };
    worker.addEventListener('message', onMessage);
  });

  worker.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'progress' && onProgressCb) {
      onProgressCb(msg.stage, msg.pct);
    } else if (msg.type === 'result' && pending) {
      const { resolve } = pending;
      pending = null;
      resolve(msg);
    } else if (msg.type === 'error' && pending) {
      const { reject } = pending;
      pending = null;
      reject(new Error(msg.message));
    }
  });

  worker.addEventListener('error', (e) => {
    if (pending) {
      const { reject } = pending;
      pending = null;
      reject(new Error(`Worker error: ${e.message}`));
    }
  });

  // Kick off model load proactively — user will likely transcribe soon.
  worker.postMessage({ type: 'init' });

  return worker;
}

/**
 * Decode a recorded audio Blob (webm/opus, wav, etc.) into a 16kHz mono
 * Float32Array suitable for the worker.
 *
 * Uses OfflineAudioContext so the resample happens entirely off the
 * realtime audio graph and is deterministic.
 *
 * @param {Blob} blob
 * @returns {Promise<Float32Array>}
 */
export async function blobToMono16kFloat32(blob) {
  const arrayBuf = await blob.arrayBuffer();

  // Short-lived AudioContext just to decode the container format.
  // Some browsers require this to be at a "real" rate; 48kHz is safe.
  const AC = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AC();
  let decoded;
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuf);
  } finally {
    decodeCtx.close?.();
  }

  const srcChannels = decoded.numberOfChannels;
  const srcRate = decoded.sampleRate;
  const srcLength = decoded.length;

  // Build a 16kHz mono OfflineAudioContext and render the decoded buffer
  // through it — this is the cleanest, most portable resample path.
  const dstLength = Math.ceil((srcLength * TARGET_SAMPLE_RATE) / srcRate);
  const offline = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    1,
    dstLength,
    TARGET_SAMPLE_RATE
  );

  // If source is multichannel, downmix to mono by averaging channels into
  // a new mono AudioBuffer that the offline context can play back.
  const monoBuffer = offline.createBuffer(1, srcLength, srcRate);
  const monoData = monoBuffer.getChannelData(0);
  if (srcChannels === 1) {
    monoData.set(decoded.getChannelData(0));
  } else {
    const chans = [];
    for (let c = 0; c < srcChannels; c++) chans.push(decoded.getChannelData(c));
    for (let i = 0; i < srcLength; i++) {
      let sum = 0;
      for (let c = 0; c < srcChannels; c++) sum += chans[c][i];
      monoData[i] = sum / srcChannels;
    }
  }

  const src = offline.createBufferSource();
  src.buffer = monoBuffer;
  src.connect(offline.destination);
  src.start(0);

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0); // Float32Array @ 16000Hz
}

/**
 * Transcribe an audio Blob using the local worker.
 *
 * Matches the signature of utils/api.js:chatTranscribe so callers can
 * swap imports without touching call sites.
 *
 * @param {Blob} audioBlob
 * @param {(stage: string, pct: number) => void} [onProgress]
 * @returns {Promise<{ text: string, duration_ms: number, timings?: object }>}
 */
export async function localChatTranscribe(audioBlob, onProgress) {
  getWorker(); // ensure worker exists and init has been kicked off
  await workerReady;

  onProgressCb = onProgress || null;

  const t0 = performance.now();
  const audio = await blobToMono16kFloat32(audioBlob);

  const result = await new Promise((resolve, reject) => {
    if (pending) {
      reject(new Error('Another transcription is already in progress'));
      return;
    }
    pending = { resolve, reject };
    worker.postMessage({ type: 'transcribe', audio }, [audio.buffer]);
  });

  const duration_ms = Math.round(performance.now() - t0);
  onProgressCb = null;

  return {
    text: result.text,
    duration_ms,
    timings: result.timings,
  };
}

/** Tear down the worker (e.g., on logout). */
export function disposeLocalMedasr() {
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = null;
    pending = null;
  }
}
