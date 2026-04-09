import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  reportContext: null, // { taskId, topDiagnosis, synthesis }

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

  setReportContext: (ctx) => set({ reportContext: ctx }),

  clearReportContext: () => set({ reportContext: null }),

  clearChat: () => set({ messages: [], streamingContent: '', isStreaming: false, reportContext: null }),
}));

export default useChatStore;
