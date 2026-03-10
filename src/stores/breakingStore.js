import { create } from 'zustand';
import {
  getBreakingHeadlines,
  updateBreakingPreferences,
  triggerDeepResearch,
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

  clearError: () => set({ error: null }),
}));

export default useBreakingStore;
