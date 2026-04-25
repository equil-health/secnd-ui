// DCL v1 API client — talks to the GPU pod for the differential checklist.
// Mirrors sdssV2Api.js: same VITE_GPU_POD_URL env var, same bearer/ngrok
// headers, same USE_MOCKS fallback pattern.
//
// For v1 internal testing, startCase/getCaseStatus/streamCaseStatus are
// reused from sdssV2Api — only the checklist fetch is DCL-specific.

const GPU_BASE = import.meta.env.VITE_GPU_POD_URL || '';
const USE_MOCKS = !GPU_BASE;

async function gpuFetch(path, opts = {}) {
  const url = `${GPU_BASE}${path}`;
  const { headers: optHeaders, ...restOpts } = opts;
  const res = await fetch(url, {
    ...restOpts,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...optHeaders,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = body.detail;
    const message = (detail && typeof detail === 'string')
      ? detail
      : (detail?.message || `GPU pod error ${res.status}`);
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res;
}

// ── Mock payloads ────────────────────────────────────────────────
//
// Toggle from the browser console:
//   window.__MOCK_DCL_SCENARIO = 'minimal'            → Zones 3 + 5 only
//   window.__MOCK_DCL_SCENARIO = 'full'               → All six zones (default)
//   window.__MOCK_DCL_SCENARIO = 'partial_verification' → skipped stages surfaced
//   window.__MOCK_DCL_SCENARIO = 'dev_mode'           → refusal payload
//
// Flip before clicking "Generate differential checklist".

const MOCK_DCL_FULL = {
  case_id: 'mock-case-001',
  case_meta: {
    case_text_preview: '46F, 3mo fatigue + pruritus, raised IgG 2400, ANA 1:320, 4cm…',
    age: 46,
    sex: 'female',
    submitted_at: new Date().toISOString(),
  },
  verification: {
    complete: true,
    skipped_stages: [],
  },
  dev_mode_stamp: false,
  safety_alerts: [],
  treatment_holds: [
    {
      treatment: 'systemic_corticosteroids',
      must_exclude_diagnosis: 'lymphoma',
      required_workup: [
        'Liver biopsy with immunohistochemistry',
        'CT chest/abdomen/pelvis',
        'Serum protein electrophoresis with immunofixation',
      ],
      rationale: 'Lymphoma remains in the must-exclude tier with no confirmed negative evidence. Corticosteroids could mask lymphoproliferative disease.',
      source_rule_id: 'TEKB-0001',
    },
  ],
  ranked_differential: [
    {
      rank: 1,
      diagnosis: 'Autoimmune Hepatitis',
      confidence_level: 5,
      supporting_evidence_summary: 'Elevated IgG, positive ANA 1:320, positive ASMA; classic type-1 AIH serology.',
      kg_verification_status: 'verified',
    },
    {
      rank: 2,
      diagnosis: 'Hepatocellular Carcinoma',
      confidence_level: 3,
      supporting_evidence_summary: '4cm liver lesion on CT, mild AFP elevation — warrants independent workup.',
      kg_verification_status: 'unverified',
    },
    {
      rank: 3,
      diagnosis: 'IgG4-Related Disease',
      confidence_level: 3,
      supporting_evidence_summary: 'Up to 10% of presumed AIH cases show elevated IgG4. Added by completeness audit.',
      kg_verification_status: 'unverified',
    },
    {
      rank: 4,
      diagnosis: 'Lymphoma (hepatic)',
      confidence_level: 2,
      supporting_evidence_summary: 'Must-exclude tier given hepatic lesion and markedly elevated ferritin.',
      kg_verification_status: 'not_checked',
    },
    {
      rank: 5,
      diagnosis: 'Hereditary Haemochromatosis',
      confidence_level: 2,
      supporting_evidence_summary: 'Ferritin 890, transferrin saturation pending; low prior.',
      kg_verification_status: 'verified',
    },
  ],
  completeness_additions: [
    {
      diagnosis: 'IgG4-Related Disease',
      source_cluster: 'SC-LIVER-001',
      exclusion_workup: ['Serum IgG4 subclass level', 'IgG4 immunostaining on biopsy'],
      reasoning: 'Overlap with AIH presentation; divergent treatment response makes pre-treatment differentiation important.',
    },
  ],
  next_steps: [
    {
      step: 'Liver biopsy with immunohistochemistry',
      why: 'To exclude lymphoma before corticosteroid initiation',
    },
    {
      step: 'MRI liver with hepatobiliary contrast agent',
      why: 'Characterise the 4cm lesion',
    },
    {
      step: 'Serum IgG4 subclass',
      why: 'To work up IgG4-Related Disease',
    },
  ],
  generated_at: new Date().toISOString(),
  pipeline_version: 'v2.1',
};

const MOCK_DCL_MINIMAL = {
  ...MOCK_DCL_FULL,
  case_meta: {
    case_text_preview: '28M, sore throat 3 days, no fever, no rash',
    age: 28,
    sex: 'male',
    submitted_at: new Date().toISOString(),
  },
  safety_alerts: [],
  treatment_holds: [],
  ranked_differential: [
    {
      rank: 1,
      diagnosis: 'Viral pharyngitis',
      confidence_level: 4,
      supporting_evidence_summary: 'Short duration, no systemic features, no exudate.',
      kg_verification_status: 'verified',
    },
    {
      rank: 2,
      diagnosis: 'Streptococcal pharyngitis',
      confidence_level: 2,
      supporting_evidence_summary: 'Possible but Centor score low without fever.',
      kg_verification_status: 'verified',
    },
  ],
  completeness_additions: [],
  next_steps: [
    { step: 'Supportive care with analgesia', why: 'Self-limiting presentation' },
    { step: 'Consider rapid strep if fever develops', why: 'To rule out GAS' },
    { step: 'Safety-net advice for red flags', why: 'Ensure escalation if symptoms worsen' },
  ],
};

const MOCK_DCL_PARTIAL_VERIFICATION = {
  ...MOCK_DCL_FULL,
  verification: {
    complete: false,
    skipped_stages: ['p2_verify', 'evidence_pipeline'],
  },
};

const MOCK_DCL_DEV_MODE = {
  ...MOCK_DCL_FULL,
  dev_mode_stamp: true,
};

function pickMockPayload() {
  const scenario = (typeof window !== 'undefined' && window.__MOCK_DCL_SCENARIO) || 'full';
  switch (scenario) {
    case 'minimal': return MOCK_DCL_MINIMAL;
    case 'partial_verification': return MOCK_DCL_PARTIAL_VERIFICATION;
    case 'dev_mode': return MOCK_DCL_DEV_MODE;
    case 'full':
    default: return MOCK_DCL_FULL;
  }
}

function mockDelay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Exported API ─────────────────────────────────────────────────

/**
 * Fetch the six-zone DCL checklist for a completed case.
 *
 * Contract matches the GPU pod's GET /v2/case/{id}/dcl_checklist response
 * (see DCL_v1_GPU_Pod_Implementation.md §6).
 *
 * @param {string} caseId
 * @returns {Promise<object>}
 */
export async function getDclChecklist(caseId) {
  if (USE_MOCKS) {
    await mockDelay(150);
    const payload = pickMockPayload();
    return { ...payload, case_id: caseId };
  }

  const res = await gpuFetch(`/v2/case/${caseId}/dcl_checklist`);
  return res.json();
}
