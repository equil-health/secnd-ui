// SDSS v2 API client — talks to the GPU pod, not the DO backend.
// Uses VITE_GPU_POD_URL env var. Falls back to mock data when the
// env var is not set (development against mocks).

const GPU_BASE = import.meta.env.VITE_GPU_POD_URL || '';
const USE_MOCKS = !GPU_BASE;

// ── Helpers ──────────────────────────────────────────────────────

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
    // 503 queue_full shape: detail = {error, message, queue_depth}
    const detail = body.detail;
    let message;
    let queueDepth = null;
    if (detail && typeof detail === 'object') {
      message = detail.message || detail.error || `GPU pod error ${res.status}`;
      queueDepth = detail.queue_depth || null;
    } else {
      message = detail || body.error || `GPU pod error ${res.status}`;
    }
    const err = new Error(message);
    err.status = res.status;
    err.queueDepth = queueDepth;
    err.retryAfter = parseInt(res.headers.get('Retry-After'), 10) || null;
    if (res.status === 503 && (detail?.error === 'queue_full' || queueDepth)) {
      err.code = 'queue_full';
    }
    throw err;
  }
  return res;
}

// ── Mock data ────────────────────────────────────────────────────

const MOCK_STAGES = [
  { stage: 'image_analysis', duration_ms: 0 },
  { stage: 'p1_medgemma', duration_ms: 4200 },
  { stage: 'guard', duration_ms: 870 },
  { stage: 'threshold_contextualiser', duration_ms: 12 },
  { stage: 'extraction', duration_ms: 2100 },
  { stage: 'claim_extraction', duration_ms: 1800 },
  { stage: 'serper', duration_ms: 3200 },
  { stage: 'p2_verify', duration_ms: 1400 },
  { stage: 'synthesis', duration_ms: 2200 },
  { stage: 'treatment_gate', duration_ms: 800 },
  { stage: 'differential_completeness', duration_ms: 600 },
  { stage: 'report_compiled', duration_ms: 200 },
];

const MOCK_REPORT_MD = `_📋 **Provisional Verified Report — Deep Literature Research Pending.**_

---

## 1. Executive Verdict

**CAUTION.** The presentation is most consistent with **autoimmune hepatitis** (AIH), supported by elevated IgG, positive ANA/ASMA, and hepatic involvement. However, several differential diagnoses require exclusion before initiating treatment.

---

## 2a. Critical Safety Alerts

No critical safety alerts at this time.

---

## 2b. Treatment Hold Instructions

⛔ **TREATMENT HOLD — DO NOT INITIATE PENDING WORKUP COMPLETION**

**HOLD: systemic_corticosteroids** (prednisolone, methylprednisolone, dexamethasone)

Reason: lymphoma remains in the must-exclude tier with no confirmed negative evidence. Corticosteroid therapy for presumed AIH could mask lymphoproliferative disease.

**Required workup before treatment:** Liver biopsy with immunohistochemistry, CT chest/abdomen/pelvis, serum protein electrophoresis with immunofixation.

---

## 3. Imaging Summary

4cm liver lesion identified on CT. Characterisation insufficient from available imaging. MRI with contrast (Eovist/Primovist) recommended for lesion characterisation prior to biopsy planning.

---

## 4. Reconciled Differential

| Rank | Diagnosis | Confidence | Verification |
|------|-----------|------------|--------------|
| 1 | Autoimmune Hepatitis | High | KG-verified ✓ |
| 2 | Hepatocellular Carcinoma | Moderate | Evidence-supported |
| 3 | IgG4-Related Disease | Moderate | Completeness-added |
| 4 | Lymphoma (hepatic) | Low–Moderate | Must-exclude |
| 5 | Hereditary Hemochromatosis | Low | KG-verified ✓ |

---

## 5. Completeness Audit

**Diagnoses added by completeness check:** IgG4-Related Disease (cluster SC-LIVER-001)

---

## 6. Evidence Base

- Czaja AJ. Diagnosis and management of autoimmune hepatitis. *Hepatology*. 2010;51(6):2193-2213. [Grade A]
- European Association for the Study of the Liver. EASL Clinical Practice Guidelines: Autoimmune hepatitis. *J Hepatol*. 2015;63(4):971-1004. [Grade A]
- Kamisawa T, et al. IgG4-related disease. *Lancet*. 2015;385(9976):1460-1471. [Grade B]

---

## 7. Knowledge Gaps

- Liver biopsy results (critical for AIH diagnosis and grading)
- MRI characterisation of the 4cm lesion
- Serum IgG4 subclass level (to evaluate IgG4-RD)
- Viral hepatitis panel (HAV, HBV, HCV)

---

## 8. Clinical Recommendations

1. **Urgent:** Liver biopsy with interface hepatitis grading and IgG4 immunostaining
2. **Urgent:** MRI liver with hepatobiliary contrast agent
3. Serum protein electrophoresis + immunofixation
4. Serum IgG4 subclass
5. Complete viral hepatitis panel
6. CT chest for lymphoma staging if biopsy equivocal
7. **Do not initiate corticosteroids** until lymphoma excluded

---

*Disclaimer: This AI-generated report is for clinical decision support only. It does not constitute medical advice and must be interpreted by a qualified healthcare professional in the context of the individual patient.*
`;

const MOCK_REPORT_JSON = {
  case_id: 'mock-case-001',
  version: 1,
  compiled_at: new Date().toISOString(),
  is_provisional: true,
  verification_chain_complete: true,
  dev_mode_stamp: false,
  section_count: 9,
  has_critical_flags: false,
  treatment_holds: [
    {
      treatment: 'systemic_corticosteroids',
      unexcluded_diagnosis: 'lymphoma',
      urgency: 'before_treatment',
      rule_id: 'TEKB-0001',
    },
  ],
  completeness_added: [
    { diagnosis: 'IgG4-Related Disease', cluster: 'SC-LIVER-001' },
  ],
  primary_diagnosis: 'autoimmune hepatitis',
  markdown: MOCK_REPORT_MD,
};

const MOCK_AUDIT = {
  case_id: 'mock-case-001',
  mode: 'standard',
  started_at: new Date().toISOString(),
  phase_a: {
    p1_medgemma: { duration_ms: 4200, summary: 'Generated initial differential with 5 candidates' },
    guard: { duration_ms: 870, issues_found: 0 },
    threshold_contextualiser: {
      findings_contextualised: 4,
      findings_without_ctr_entry: ['transferrin saturation', 'ALP'],
      modifier_warnings: ['Ferritin elevation may be reactive — correlate with CRP'],
    },
    triplet_extraction: { duration_ms: 2100, triplets_extracted: 42 },
    claim_extraction: { duration_ms: 1800, claims_extracted: 18 },
    evidence_pipeline: { duration_ms: 3200, serper_hits: 12, openalex_hits: 8 },
    p2_verify: { duration_ms: 1400, triplets_verified: 42, triplets_refuted: 3 },
    synthesis: { duration_ms: 2200 },
    treatment_gate: {
      holds_generated: 1,
      verdict_override: 'CAUTION',
      tekb_version: '1.0.0',
    },
    differential_completeness: {
      active_clusters: ['SC-LIVER-001'],
      diagnoses_added: ['IgG4-Related Disease'],
      scmcm_version: '1.0.0',
    },
    report_compiled: { version: 1, section_count: 9, verification_chain_complete: true },
  },
  phase_b: {},
  chat_turns: [],
  final: { total_duration_ms: 17282, estimated_cost_usd: 0.043 },
};

// ── Mock helpers ─────────────────────────────────────────────────

let mockCases = {};

function mockDelay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Bounded mock executor: mirrors backend (max_workers=2, queue_max=8).
// Flip these for manual 503 testing — set window.__MOCK_QUEUE_FULL = true
// in the browser console to force the next startCase to reject with 503.
const MOCK_MAX_WORKERS = 2;
const MOCK_QUEUE_MAX = 8;
const MOCK_QUEUED_HOLD_MS = 1500; // simulate `queued` before pickup

function mockInFlight() {
  return Object.values(mockCases).filter(
    (c) => c.status === 'queued' || c.status === 'running_phase_a' || c.status === 'running_phase_b',
  ).length;
}

function createMockCase(caseText, mode) {
  const id = `mock-${Date.now().toString(36)}`;
  const now = Date.now();
  mockCases[id] = {
    id,
    caseText,
    mode,
    startedAt: now,
    status: 'queued',
    stageIndex: 0,
    phaseADone: false,
    phaseBStatus: null,
  };

  // After a short hold in `queued`, flip to running_phase_a and advance stages.
  setTimeout(() => {
    const c = mockCases[id];
    if (!c) return;
    c.status = 'running_phase_a';
    c.startedAt = Date.now();
    let delay = 0;
    MOCK_STAGES.forEach((s, i) => {
      delay += 800 + Math.random() * 400;
      setTimeout(() => {
        const cc = mockCases[id];
        if (cc) {
          cc.stageIndex = i + 1;
          if (i === MOCK_STAGES.length - 1) {
            cc.status = 'phase_a_complete';
            cc.phaseADone = true;
          }
        }
      }, delay);
    });
  }, MOCK_QUEUED_HOLD_MS);

  return { id };
}

// ── Exported API functions ───────────────────────────────────────

/**
 * Start a new case.
 * @returns {Promise<{case_id, status, started_at, phase_a_target_latency_s, phase_a_hard_timeout_s}>}
 */
export async function startCase({ caseText, mode = 'standard', patientContext, images }) {
  if (USE_MOCKS) {
    await mockDelay(200);
    const inFlight = mockInFlight();
    const force503 = typeof window !== 'undefined' && window.__MOCK_QUEUE_FULL === true;
    if (force503 || inFlight >= MOCK_MAX_WORKERS + MOCK_QUEUE_MAX) {
      const err = new Error('SDSS is at maximum capacity. Retry after current cases complete.');
      err.status = 503;
      err.code = 'queue_full';
      err.retryAfter = 60;
      err.queueDepth = {
        in_flight: inFlight,
        max_workers: MOCK_MAX_WORKERS,
        queue_max: MOCK_QUEUE_MAX,
        capacity_remaining: 0,
        shutting_down: false,
      };
      throw err;
    }
    const { id } = createMockCase(caseText, mode);
    return {
      case_id: id,
      status: 'queued',
      started_at: new Date().toISOString(),
      phase_a_target_latency_s: 180,
      phase_a_hard_timeout_s: 360,
    };
  }

  const res = await gpuFetch('/v2/case/start', {
    method: 'POST',
    body: JSON.stringify({
      case_text: caseText,
      mode,
      patient_context: patientContext || undefined,
      images: images || [],
    }),
  });
  return res.json();
}

/**
 * Poll case status.
 * @returns {Promise<object>}
 */
export async function getCaseStatus(caseId) {
  if (USE_MOCKS) {
    await mockDelay(100);
    const c = mockCases[caseId];
    if (!c) throw Object.assign(new Error('Case not found'), { status: 404 });

    const completed = MOCK_STAGES.slice(0, c.stageIndex);
    const pending = MOCK_STAGES.slice(c.stageIndex).map((s) => s.stage);

    if (c.phaseBStatus === 'running') {
      return {
        case_id: caseId,
        status: 'running_phase_b',
        report_version: 1,
        phase_b_current_stage: 'storm',
        phase_b_elapsed_ms: Date.now() - c.phaseBStarted,
      };
    }
    if (c.phaseBStatus === 'complete') {
      return {
        case_id: caseId,
        status: 'phase_b_complete',
        report_version: 2,
        phase_a_duration_ms: 17282,
        phase_b_duration_ms: 12000,
        verification_chain_complete: true,
        supersedes_version: 1,
      };
    }

    if (c.phaseADone) {
      return {
        case_id: caseId,
        status: 'phase_a_complete',
        report_version: 1,
        phase_a_duration_ms: 17282,
        verification_chain_complete: true,
        has_critical_flags: false,
        treatment_holds_count: 1,
        completeness_diagnoses_added: 1,
        primary_diagnosis: 'autoimmune hepatitis',
      };
    }

    if (c.status === 'queued') {
      const inFlight = mockInFlight();
      return {
        case_id: caseId,
        status: 'queued',
        stages_completed: [],
        stages_pending: MOCK_STAGES.map((s) => s.stage),
        elapsed_ms: Date.now() - c.startedAt,
        queue_info: {
          in_flight: inFlight,
          max_workers: MOCK_MAX_WORKERS,
          queue_max: MOCK_QUEUE_MAX,
          capacity_remaining: MOCK_MAX_WORKERS + MOCK_QUEUE_MAX - inFlight,
          shutting_down: false,
        },
      };
    }

    return {
      case_id: caseId,
      status: 'running_phase_a',
      current_stage: MOCK_STAGES[c.stageIndex]?.stage || 'initialising',
      stages_completed: completed.map((s) => ({ stage: s.stage, duration_ms: s.duration_ms })),
      stages_pending: pending,
      elapsed_ms: Date.now() - c.startedAt,
      queue_position: 0,
    };
  }

  const res = await gpuFetch(`/v2/case/${caseId}/status`);
  return res.json();
}

/**
 * Open SSE stream for case status.
 * @returns {EventSource}
 */
export function streamCaseStatus(caseId) {
  if (USE_MOCKS) {
    // Return a mock EventSource-like object
    const handlers = {};
    const mock = {
      addEventListener: (type, fn) => { handlers[type] = fn; },
      removeEventListener: (type) => { delete handlers[type]; },
      close: () => { clearInterval(mock._interval); },
      _interval: null,
    };

    let stageIdx = 0;
    mock._interval = setInterval(() => {
      const c = mockCases[caseId];
      if (!c) { mock.close(); return; }

      if (stageIdx < c.stageIndex) {
        const stage = MOCK_STAGES[stageIdx];
        handlers.stage_completed?.({ data: JSON.stringify({ stage: stage.stage, duration_ms: stage.duration_ms }) });
        stageIdx++;

        if (stageIdx < MOCK_STAGES.length) {
          handlers.stage_started?.({ data: JSON.stringify({ stage: MOCK_STAGES[stageIdx].stage }) });
        }
      }

      if (c.phaseADone && stageIdx >= MOCK_STAGES.length) {
        handlers.phase_complete?.({ data: JSON.stringify({ phase: 'A', report_version: 1 }) });
        mock.close();
      }
    }, 500);

    // Fire first stage_started
    setTimeout(() => {
      handlers.stage_started?.({ data: JSON.stringify({ stage: MOCK_STAGES[0].stage }) });
    }, 100);

    return mock;
  }

  // Real backend SSE doesn't work through ngrok free tier (no custom headers
  // on EventSource, and ngrok shows an interstitial). Return a no-op object
  // so the caller's polling fallback handles everything.
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    close: () => {},
  };
}

/**
 * Fetch case report.
 * @param {string} caseId
 * @param {'json'|'markdown'} [format='json']
 * @returns {Promise<object>}
 */
export async function getCaseReport(caseId, format = 'json') {
  if (USE_MOCKS) {
    await mockDelay(100);
    const c = mockCases[caseId];
    const isV2 = c?.phaseBStatus === 'complete';
    if (format === 'json') {
      return {
        ...MOCK_REPORT_JSON,
        case_id: caseId,
        version: isV2 ? 2 : 1,
        is_provisional: !isV2,
        markdown: isV2
          ? MOCK_REPORT_MD.replace(
              '_📋 **Provisional Verified Report — Deep Literature Research Pending.**_',
              '_📋 **Verified Report v2 — Deep Literature Research Complete.**_'
            ) + '\n\n---\n\n## 9. STORM Deep Research Summary\n\nAutoimmune hepatitis (AIH) is a chronic inflammatory liver disease characterised by interface hepatitis, hypergammaglobulinaemia, and circulating autoantibodies. Type 1 AIH (positive ANA/ASMA) accounts for approximately 80% of cases and typically responds to immunosuppressive therapy.\n\n**Key findings from deep literature review:**\n\n- **Simplified diagnostic criteria (IAIHG 2008):** ANA/ASMA ≥1:40 (1 point), IgG > ULN (1 point), liver histology compatible (1 point), absence of viral hepatitis (1 point). Score ≥6 = probable AIH. This patient scores ≥6 based on serology alone.\n- **AFP in AIH:** Mild AFP elevation (< 100 ng/mL) is seen in 20-30% of AIH patients with active inflammation and does not independently predict hepatocellular carcinoma. However, the 4cm liver lesion warrants independent evaluation.\n- **IgG4-RD overlap:** Up to 10% of presumed AIH cases show elevated IgG4 and respond differently to standard therapy. IgG4 subclass testing is critical before treatment initiation.\n- **Treatment hold rationale confirmed:** Literature strongly supports excluding lymphoma before corticosteroid initiation in patients with hepatic lesions and markedly elevated ferritin, as corticosteroids can produce transient improvement in lymphoproliferative disease, delaying diagnosis by 3-6 months.\n\n*12 sources reviewed, 8 high-quality (Grade A-B), 4 supporting (Grade C).*\n'
          : MOCK_REPORT_MD,
      };
    }
    return isV2
      ? MOCK_REPORT_MD.replace('Provisional Verified Report', 'Verified Report v2 — Deep Literature Research Complete')
      : MOCK_REPORT_MD;
  }

  const suffix = format === 'json' ? '?format=json' : '';
  const res = await gpuFetch(`/v2/case/${caseId}/report${suffix}`);
  return format === 'json' ? res.json() : res.text();
}

/**
 * Trigger Phase B deep dive.
 * @returns {Promise<object>}
 */
export async function triggerDeepDive(caseId) {
  if (USE_MOCKS) {
    await mockDelay(200);
    const c = mockCases[caseId];
    if (!c?.phaseADone) throw Object.assign(new Error('Phase A not complete'), { status: 409 });

    c.phaseBStatus = 'queued';
    c.phaseBStarted = Date.now();
    c.status = 'queued';

    // After short hold, flip to running_phase_b, then complete ~8s later
    setTimeout(() => {
      if (!mockCases[caseId]) return;
      mockCases[caseId].phaseBStatus = 'running';
      mockCases[caseId].status = 'running_phase_b';
      setTimeout(() => {
        const cc = mockCases[caseId];
        if (!cc) return;
        cc.phaseBStatus = 'complete';
        cc.status = 'phase_b_complete';
      }, 8000);
    }, MOCK_QUEUED_HOLD_MS);

    return {
      case_id: caseId,
      status: 'queued',
      started_at: new Date().toISOString(),
      phase_b_target_latency_s: 180,
    };
  }

  const res = await gpuFetch(`/v2/case/${caseId}/deep_dive`, { method: 'POST', body: '{}' });
  return res.json();
}

/**
 * Fetch audit trail.
 * @returns {Promise<object>}
 */
export async function getCaseAudit(caseId) {
  if (USE_MOCKS) {
    await mockDelay(100);
    return { ...MOCK_AUDIT, case_id: caseId };
  }

  const res = await gpuFetch(`/v2/case/${caseId}/audit`);
  return res.json();
}

/**
 * Chat with the case-aware model.
 *
 * Backend returns a complete OpenAI-compatible JSON response (non-streaming).
 * Mock mode simulates word-by-word streaming for a realistic dev experience.
 *
 * @returns {Promise<{content: string, queuePosition: number, reportVersionUsed: number}>}
 */
export async function chatCompletion(caseId, messages, { maxTokens = 512, temperature = 0.4 } = {}) {
  if (USE_MOCKS) {
    const mockText = "Based on the verified report, autoimmune hepatitis (AIH) is the leading diagnosis supported by the combination of elevated IgG (2400 mg/dL), positive ANA at 1:320, and positive ASMA. These three markers together form the classic serological triad for type 1 AIH.\n\nHowever, the treatment hold on corticosteroids is critical here — lymphoma must be excluded first because:\n\n1. The 4cm liver lesion is uncharacterised\n2. Ferritin is markedly elevated at 890 ng/mL (though CRP elevation suggests this may be partially reactive)\n3. Corticosteroids could mask lymphoproliferative disease\n\nThe recommended next steps are liver biopsy with immunohistochemistry and MRI with hepatobiliary contrast agent before any treatment decisions.";

    // Simulate latency
    await mockDelay(800 + Math.random() * 1200);
    return {
      content: mockText,
      queuePosition: 0,
      reportVersionUsed: 1,
    };
  }

  const res = await gpuFetch('/v2/chat/completions', {
    method: 'POST',
    headers: {
      'X-SECND-Case-Id': caseId,
    },
    body: JSON.stringify({
      model: 'secnd-chat',
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  });
  const data = await res.json();

  return {
    content: data.choices?.[0]?.message?.content || '',
    queuePosition: data.secnd?.queue_position || 0,
    reportVersionUsed: data.secnd?.report_version_used || 0,
  };
}

/**
 * List recent cases (optional endpoint).
 * @returns {Promise<{cases: Array}>}
 */
export async function listCases() {
  if (USE_MOCKS) {
    await mockDelay(100);
    return { cases: Object.values(mockCases).map((c) => ({
      case_id: c.id,
      status: c.status,
      started_at: new Date(c.startedAt).toISOString(),
      primary_diagnosis: c.phaseADone ? 'autoimmune hepatitis' : null,
      mode: c.mode,
    })) };
  }

  const res = await gpuFetch('/v2/cases');
  return res.json();
}

// Stage display name mapping — keys must match backend stage names
export const STAGE_LABELS = {
  image_analysis: 'Analysing images',
  p1_medgemma: 'Generating differential diagnosis',
  guard: 'Running safety guard',
  threshold_contextualiser: 'Contextualising lab thresholds',
  extraction: 'Extracting clinical triplets',
  claim_extraction: 'Extracting claims for evidence search',
  serper: 'Searching medical evidence',
  p2_verify: 'Verifying against knowledge graph',
  synthesis: 'Synthesising findings',
  treatment_gate: 'Checking treatment safety',
  differential_completeness: 'Completeness audit',
  report_compiled: 'Compiling report',
  storm: 'Deep literature research (STORM)',
  // Legacy aliases (mock data compatibility)
  triplet_extraction: 'Extracting clinical triplets',
  evidence_pipeline: 'Searching medical evidence',
};

export const STAGE_ORDER = [
  'image_analysis', 'p1_medgemma', 'guard', 'threshold_contextualiser',
  'extraction', 'claim_extraction', 'serper',
  'p2_verify', 'synthesis', 'treatment_gate', 'differential_completeness',
  'report_compiled',
];
