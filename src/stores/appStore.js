import { create } from 'zustand';

const useAppStore = create((set) => ({
  // Active case
  activeCase: null,
  setActiveCase: (c) => set({ activeCase: c }),

  // Pipeline steps
  pipelineSteps: [],
  pipelineStatus: null, // 'running' | 'complete' | 'error'
  setPipelineSteps: (steps) => set({ pipelineSteps: steps }),
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
  updateStep: (stepIndex, updates) =>
    set((state) => {
      const steps = [...state.pipelineSteps];
      if (steps[stepIndex]) {
        steps[stepIndex] = { ...steps[stepIndex], ...updates };
      }
      return { pipelineSteps: steps };
    }),

  // Report
  report: null,
  setReport: (r) => set({ report: r }),

  // Chat messages
  messages: [],
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),

  // Form modal
  isFormOpen: false,
  setFormOpen: (open) => set({ isFormOpen: open }),

  // Reset for new case
  resetCase: () =>
    set({
      activeCase: null,
      pipelineSteps: [],
      pipelineStatus: null,
      report: null,
      messages: [],
    }),
}));

export default useAppStore;
