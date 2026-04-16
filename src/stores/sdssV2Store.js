import { create } from 'zustand';

/**
 * Zustand store for SDSS v2 case lifecycle.
 *
 * Tracks: case submission → Phase A progress → report → Phase B → chat.
 */
const useSdssV2Store = create((set, get) => ({
  // ── Case state ─────────────────────────────────────────────────
  caseId: null,
  status: 'idle', // idle | submitting | running_phase_a | phase_a_complete | running_phase_b | phase_b_complete | failed
  caseText: '',
  mode: 'standard',
  error: null,

  // ── Phase A progress ───────────────────────────────────────────
  stagesCompleted: [],  // [{ stage, duration_ms }]
  stagesPending: [],    // [stage_name]
  currentStage: null,
  elapsedMs: 0,
  queuePosition: 0,

  // ── Report ─────────────────────────────────────────────────────
  report: null,         // { case_id, version, markdown, is_provisional, treatment_holds, completeness_added, ... }
  reportVersion: 0,

  // ── Phase B ────────────────────────────────────────────────────
  phaseBElapsedMs: 0,

  // ── Audit ──────────────────────────────────────────────────────
  audit: null,
  auditOpen: false,

  // ── Chat ───────────────────────────────────────────────────────
  chatMessages: [],     // [{ role, content, ts }]
  chatStreaming: false,
  chatStreamContent: '',
  chatQueuePosition: 0,

  // ── Actions ────────────────────────────────────────────────────

  startCase: (caseId, caseText, mode) => set({
    caseId,
    caseText,
    mode,
    status: 'running_phase_a',
    error: null,
    stagesCompleted: [],
    stagesPending: [],
    currentStage: null,
    elapsedMs: 0,
    queuePosition: 0,
    report: null,
    reportVersion: 0,
    phaseBElapsedMs: 0,
    audit: null,
    chatMessages: [],
    chatStreaming: false,
    chatStreamContent: '',
  }),

  updateStatus: (data) => {
    const updates = { status: data.status };
    if (data.stages_completed) updates.stagesCompleted = data.stages_completed;
    if (data.stages_pending) updates.stagesPending = data.stages_pending;
    if (data.current_stage) updates.currentStage = data.current_stage;
    if (data.elapsed_ms != null) updates.elapsedMs = data.elapsed_ms;
    if (data.queue_position != null) updates.queuePosition = data.queue_position;
    if (data.report_version) updates.reportVersion = data.report_version;
    if (data.phase_b_elapsed_ms != null) updates.phaseBElapsedMs = data.phase_b_elapsed_ms;
    if (data.error) updates.error = data.error;
    set(updates);
  },

  stageStarted: (stage) => set({ currentStage: stage }),

  stageCompleted: (stage, durationMs) => set((state) => ({
    stagesCompleted: [...state.stagesCompleted, { stage, duration_ms: durationMs }],
    stagesPending: state.stagesPending.filter((s) => s !== stage),
    currentStage: null,
  })),

  phaseAComplete: () => set({ status: 'phase_a_complete', currentStage: null }),

  setReport: (report) => set({
    report,
    reportVersion: report.version || 1,
  }),

  startPhaseB: () => set({ status: 'running_phase_b', phaseBElapsedMs: 0 }),

  phaseBComplete: (newVersion) => set({ status: 'phase_b_complete', reportVersion: newVersion || 2 }),

  setFailed: (error) => set({ status: 'failed', error }),

  // Audit
  setAudit: (audit) => set({ audit }),
  toggleAudit: () => set((s) => ({ auditOpen: !s.auditOpen })),

  // Chat
  addChatMessage: (msg) => set((s) => ({
    chatMessages: [...s.chatMessages, { ...msg, ts: msg.ts || new Date().toISOString() }],
  })),

  setChatStreaming: (v) => set({ chatStreaming: v }),

  appendChatChunk: (text) => set((s) => ({ chatStreamContent: s.chatStreamContent + text })),

  finalizeChatStream: () => {
    const content = get().chatStreamContent;
    if (content) {
      set((s) => ({
        chatMessages: [...s.chatMessages, { role: 'assistant', content, ts: new Date().toISOString() }],
        chatStreamContent: '',
        chatStreaming: false,
      }));
    } else {
      set({ chatStreamContent: '', chatStreaming: false });
    }
  },

  setChatQueuePosition: (pos) => set({ chatQueuePosition: pos }),

  // Reset
  reset: () => set({
    caseId: null,
    status: 'idle',
    caseText: '',
    mode: 'standard',
    error: null,
    stagesCompleted: [],
    stagesPending: [],
    currentStage: null,
    elapsedMs: 0,
    queuePosition: 0,
    report: null,
    reportVersion: 0,
    phaseBElapsedMs: 0,
    audit: null,
    auditOpen: false,
    chatMessages: [],
    chatStreaming: false,
    chatStreamContent: '',
    chatQueuePosition: 0,
  }),
}));

export default useSdssV2Store;
