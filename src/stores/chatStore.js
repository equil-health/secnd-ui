import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  taskId: null,          // SDSS task ID — backend loads full report from DB
  reportLabel: null,     // Display label for context banner

  // Inline analysis state
  analysisTaskId: null,  // Task ID of an in-progress analysis triggered from chat
  analysisStatus: null,  // pending | processing | complete | failed
  analysisCaseText: '',  // The case text being analysed

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setStreaming: (v) => set({ isStreaming: v }),

  appendStreamChunk: (text) =>
    set((state) => ({ streamingContent: state.streamingContent + text })),

  finalizeStream: () => {
    const content = get().streamingContent;
    if (content) {
      set((state) => ({
        messages: [...state.messages, { role: 'assistant', content, ts: new Date().toISOString() }],
        streamingContent: '',
        isStreaming: false,
      }));
    } else {
      set({ streamingContent: '', isStreaming: false });
    }
  },

  setTaskContext: (taskId, label) => set({ taskId, reportLabel: label }),
  clearTaskContext: () => set({ taskId: null, reportLabel: null }),

  // Start an inline analysis
  startAnalysis: (analysisTaskId, caseText) => set({
    analysisTaskId,
    analysisStatus: 'pending',
    analysisCaseText: caseText,
  }),

  // Update analysis progress
  setAnalysisStatus: (status) => set({ analysisStatus: status }),

  // Analysis complete — load report context into the chat
  completeAnalysis: (taskId, topDiagnosis) => set({
    taskId,
    reportLabel: topDiagnosis || 'SDSS Report',
    analysisTaskId: null,
    analysisStatus: null,
    analysisCaseText: '',
  }),

  // Analysis failed
  failAnalysis: () => set({
    analysisTaskId: null,
    analysisStatus: null,
    analysisCaseText: '',
  }),

  clearChat: () => set({
    messages: [],
    streamingContent: '',
    isStreaming: false,
    taskId: null,
    reportLabel: null,
    analysisTaskId: null,
    analysisStatus: null,
    analysisCaseText: '',
  }),
}));

export default useChatStore;
