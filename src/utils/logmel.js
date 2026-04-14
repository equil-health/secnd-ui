// Log-mel feature extractor for MedASR (LasrFeatureExtractor parity).
//
// Python reference: transformers commit 65dc261, models/lasr/feature_extraction_lasr.py
// Spec:
//   sample_rate = 16000
//   n_fft       = 512
//   win_length  = 400
//   hop_length  = 160
//   n_mels      = 128
//   window      = symmetric Hann (periodic=False)
//   framing     = unfold, center=False, no reflect padding
//   power       = |rfft|^2 (squared magnitude)
//   mel scale   = Kaldi: mel = 1127 * ln(1 + f/700)
//   mel edges   = 125 Hz to 7500 Hz
//   log         = log(clamp(power @ mel, 1e-5))  (natural log, floor 1e-5)
//
// The mel filterbank is NOT recomputed in JS — we load the exact matrix
// dumped from Python at build time to guarantee numerical parity.
//
// Output: Float32Array length n_frames * 128 (row-major, frame-major).

const SAMPLE_RATE = 16000;
const N_FFT = 512;
const WIN_LENGTH = 400;
const HOP_LENGTH = 160;
const N_MELS = 128;
const N_SPEC_BINS = N_FFT / 2 + 1; // 257
const LOG_FLOOR = 1e-5;

// ── Precomputed constants (lazy) ─────────────────────────────────
let _hannWindow = null;
let _fftTables = null;

function symmetricHannWindow(n) {
  // torch.hann_window(n, periodic=False): w[i] = 0.5*(1 - cos(2π*i/(n-1)))
  const w = new Float64Array(n);
  const denom = n - 1;
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
  }
  return w;
}

function getHannWindow() {
  if (!_hannWindow) _hannWindow = symmetricHannWindow(WIN_LENGTH);
  return _hannWindow;
}

// ── In-place radix-2 complex FFT ─────────────────────────────────
function buildFftTables(n) {
  // bit-reversal permutation + twiddle factors
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let x = i;
    let r = 0;
    for (let b = 0; b < bits; b++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    rev[i] = r;
  }
  // twiddle[k] = e^(-2πi k / n) for k in 0..n/2
  const twRe = new Float64Array(n / 2);
  const twIm = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    const a = (-2 * Math.PI * k) / n;
    twRe[k] = Math.cos(a);
    twIm[k] = Math.sin(a);
  }
  return { rev, twRe, twIm };
}

function getFftTables() {
  if (!_fftTables) _fftTables = buildFftTables(N_FFT);
  return _fftTables;
}

function fftInPlace(re, im) {
  const n = re.length;
  const { rev, twRe, twIm } = getFftTables();

  // bit-reverse reorder
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  // butterflies
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < half; j++) {
        const k = j * step;
        const wRe = twRe[k];
        const wIm = twIm[k];
        const aIdx = i + j;
        const bIdx = i + j + half;
        const bRe = re[bIdx];
        const bIm = im[bIdx];
        // t = w * b
        const tRe = wRe * bRe - wIm * bIm;
        const tIm = wRe * bIm + wIm * bRe;
        re[bIdx] = re[aIdx] - tRe;
        im[bIdx] = im[aIdx] - tIm;
        re[aIdx] = re[aIdx] + tRe;
        im[aIdx] = im[aIdx] + tIm;
      }
    }
  }
}

// ── Main extractor ───────────────────────────────────────────────
/**
 * @param {Float32Array} audio  mono 16kHz
 * @param {Float64Array|Float32Array} melFilters  length 257*128, row-major
 *        (spec_bin, mel) — matches Python shape (257, 128)
 * @returns {{features: Float32Array, shape: [number, number], mask: Uint8Array}}
 */
export function extractLogMelFeatures(audio, melFilters) {
  if (!(audio instanceof Float32Array) && !(audio instanceof Float64Array)) {
    throw new TypeError('audio must be Float32Array or Float64Array');
  }
  if (melFilters.length !== N_SPEC_BINS * N_MELS) {
    throw new Error(
      `melFilters length ${melFilters.length}, expected ${N_SPEC_BINS * N_MELS}`
    );
  }
  const N = audio.length;
  if (N < WIN_LENGTH) {
    return {
      features: new Float32Array(0),
      shape: [0, N_MELS],
      mask: new Uint8Array(0),
    };
  }

  const nFrames = 1 + Math.floor((N - WIN_LENGTH) / HOP_LENGTH);
  const window = getHannWindow();
  const features = new Float32Array(nFrames * N_MELS);

  // Reusable buffers
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);

  for (let f = 0; f < nFrames; f++) {
    const offset = f * HOP_LENGTH;

    // Window + zero-pad: fill re[0..400) with windowed samples, rest zero
    for (let i = 0; i < WIN_LENGTH; i++) {
      re[i] = window[i] * audio[offset + i];
    }
    for (let i = WIN_LENGTH; i < N_FFT; i++) re[i] = 0;
    for (let i = 0; i < N_FFT; i++) im[i] = 0;

    fftInPlace(re, im);

    // Power spectrum for bins 0..256 (rfft output)
    // power[j] = re[j]^2 + im[j]^2 for j in 0..257
    // Mel projection: mel[k] = Σ power[j] * melFilters[j*128 + k]
    // Accumulate directly into the output row.
    const outBase = f * N_MELS;

    // Initialize output row to zero
    for (let k = 0; k < N_MELS; k++) features[outBase + k] = 0;

    // Iterate spec bins; skip j=0 DC because mel_filters row 0 is all zeros
    // (saves 128 multiplications but produces identical output).
    for (let j = 1; j < N_SPEC_BINS; j++) {
      const rj = re[j];
      const ij = im[j];
      const p = rj * rj + ij * ij;
      const filtBase = j * N_MELS;
      for (let k = 0; k < N_MELS; k++) {
        features[outBase + k] += p * melFilters[filtBase + k];
      }
    }

    // log(clamp(·, 1e-5))
    for (let k = 0; k < N_MELS; k++) {
      const v = features[outBase + k];
      features[outBase + k] = Math.log(v < LOG_FLOOR ? LOG_FLOOR : v);
    }
  }

  const mask = new Uint8Array(nFrames);
  mask.fill(1);

  return { features, shape: [nFrames, N_MELS], mask };
}

/**
 * Load the precomputed mel filterbank matrix from public/models/mel_filters.json.
 * Returns a Float64Array length 257*128 in row-major (spec_bin, mel) order.
 * @param {string} url
 */
export async function loadMelFilters(url = '/models/mel_filters.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  const j = await r.json();
  if (!j.shape || j.shape[0] !== N_SPEC_BINS || j.shape[1] !== N_MELS) {
    throw new Error(`Unexpected mel_filters shape: ${JSON.stringify(j.shape)}`);
  }
  return new Float64Array(j.data);
}
