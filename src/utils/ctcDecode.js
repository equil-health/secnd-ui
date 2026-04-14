// Greedy CTC decoder + SentencePiece (Unigram/Metaspace) detokenizer for MedASR.
//
// Mirrors HuggingFace `processor.batch_decode(pred_ids)[0]` for Lasr:
//   1. argmax over vocab dim -> token ids per frame
//   2. CTC collapse: remove consecutive duplicates, then remove blank (id 0)
//   3. Skip special tokens (ids 0..3: <epsilon>, <s>, </s>, <unk>)
//   4. Metaspace decode: concat pieces, replace U+2581 with space, trim leading
//
// Validated against the Python sanity-run output:
//   '[EXAM TYPE] CT chest PE protocol {period} [INDICATION] 54-year-old female, ...'

const BLANK_ID = 0;          // <epsilon>
const BOS_ID = 1;            // <s>
const EOS_ID = 2;            // </s>
const UNK_ID = 3;            // <unk>
const METASPACE = '\u2581';  // ▁

const SPECIAL_IDS = new Set([BLANK_ID, BOS_ID, EOS_ID, UNK_ID]);

/**
 * Build a simple vocab array [piece, piece, ...] indexed by id from a parsed
 * HuggingFace tokenizer.json (Unigram + Metaspace).
 *
 * @param {object} tokenizerJson
 * @returns {string[]}  vocab[id] = piece string
 */
export function buildVocab(tokenizerJson) {
  if (tokenizerJson?.model?.type !== 'Unigram') {
    throw new Error(`Expected Unigram tokenizer, got ${tokenizerJson?.model?.type}`);
  }
  const rawVocab = tokenizerJson.model.vocab;
  const vocab = new Array(rawVocab.length);
  for (let i = 0; i < rawVocab.length; i++) {
    vocab[i] = rawVocab[i][0]; // [piece, score]
  }
  return vocab;
}

/**
 * Argmax over the vocab dim of a flat logits buffer.
 *
 * @param {Float32Array|Float64Array} logits  flat, length = T * V
 * @param {number} T  number of time steps
 * @param {number} V  vocab size (last dim)
 * @returns {Int32Array}  length T, argmax ids
 */
export function greedyArgmax(logits, T, V) {
  const out = new Int32Array(T);
  for (let t = 0; t < T; t++) {
    const base = t * V;
    let best = 0;
    let bestVal = logits[base];
    for (let k = 1; k < V; k++) {
      const v = logits[base + k];
      if (v > bestVal) {
        bestVal = v;
        best = k;
      }
    }
    out[t] = best;
  }
  return out;
}

/**
 * CTC collapse: remove consecutive duplicate ids, then drop blank.
 *
 * @param {Int32Array|number[]} ids
 * @returns {number[]}
 */
export function ctcCollapse(ids) {
  const out = [];
  let prev = -1;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (id !== prev) {
      if (id !== BLANK_ID) out.push(id);
      prev = id;
    }
  }
  return out;
}

/**
 * Turn a list of token ids into a readable string, mimicking HF
 * `batch_decode(..., skip_special_tokens=True)` for Unigram/Metaspace.
 *
 * @param {number[]} ids
 * @param {string[]} vocab
 * @returns {string}
 */
export function decodeMetaspace(ids, vocab) {
  let pieces = '';
  for (const id of ids) {
    if (SPECIAL_IDS.has(id)) continue;
    if (id < 0 || id >= vocab.length) continue; // out-of-range safety
    pieces += vocab[id];
  }
  // Metaspace replacement: ▁ -> space
  let text = pieces.split(METASPACE).join(' ');
  // Metaspace prepend_scheme="always" means the first real token starts with ▁,
  // which becomes a leading space. Trim it.
  if (text.startsWith(' ')) text = text.slice(1);
  return text;
}

/**
 * Full pipeline: logits -> text.
 *
 * @param {Float32Array|Float64Array} logits  flat, length T*V
 * @param {number} T
 * @param {number} V
 * @param {string[]} vocab
 * @returns {string}
 */
export function decodeLogits(logits, T, V, vocab) {
  const ids = greedyArgmax(logits, T, V);
  const collapsed = ctcCollapse(ids);
  return decodeMetaspace(collapsed, vocab);
}

/**
 * Load vocab from /models/tokenizer.json (browser).
 * @param {string} url
 * @returns {Promise<string[]>}
 */
export async function loadVocab(url = '/models/tokenizer.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`);
  const j = await r.json();
  return buildVocab(j);
}
