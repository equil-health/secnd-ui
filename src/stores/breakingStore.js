import { create } from 'zustand';
import {
  getBreakingHeadlines,
  updateBreakingPreferences,
  triggerDeepResearch,
  saveBreakingTopics,
  getBreakingTopics,
} from '../utils/api';

const useBreakingStore = create((set, get) => ({
  headlines: {},          // { specialty: [headline, ...] }
  alertCount: 0,
  lastUpdated: null,
  trialStatus: null,
  loading: false,
  generating: false,
  error: null,

  // Currently selected specialty tab
  activeSpecialty: null,

  fetchHeadlines: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getBreakingHeadlines();
      const specialties = Object.keys(data.headlines || {});
      set({
        headlines: data.headlines || {},
        alertCount: data.alert_count || 0,
        trialStatus: data.trial_status || null,
        lastUpdated: data.date,
        loading: false,
        activeSpecialty: get().activeSpecialty || specialties[0] || null,
      });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  setActiveSpecialty: (specialty) => set({ activeSpecialty: specialty }),

  setSpecialties: async (specialties) => {
    set({ loading: true, error: null });
    try {
      await updateBreakingPreferences(specialties);
      await get().fetchHeadlines();
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deepResearch: async (headlineId) => {
    set({ generating: true, error: null });
    try {
      const result = await triggerDeepResearch(headlineId);
      set({ generating: false });
      return result;
    } catch (err) {
      set({ generating: false, error: err.message });
      throw err;
    }
  },

  // v7.0: Doctor topics
  specialtyTopics: {},
  topicsLoading: false,

  fetchTopics: async () => {
    set({ topicsLoading: true });
    try {
      const data = await getBreakingTopics();
      set({ specialtyTopics: data || {}, topicsLoading: false });
      return data;
    } catch (err) {
      set({ topicsLoading: false, error: err.message });
      throw err;
    }
  },

  saveTopics: async (specialtyTopics) => {
    set({ topicsLoading: true, error: null });
    try {
      const result = await saveBreakingTopics(specialtyTopics);
      set({
        specialtyTopics: result.specialty_topics || {},
        topicsLoading: false,
      });
      return result;
    } catch (err) {
      set({ topicsLoading: false, error: err.message });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useBreakingStore;
