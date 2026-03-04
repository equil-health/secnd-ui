import { create } from 'zustand';
import {
  getPulsePreferences,
  upsertPulsePreferences,
  getLatestPulseDigest,
  listPulseDigests,
  getPulseDigest,
  triggerPulseDigest,
  getPulseJournals,
  getPulseSpecialties,
} from '../utils/api';

const usePulseStore = create((set, get) => ({
  preferences: null,
  latestDigest: null,
  selectedDigest: null,
  digests: [],
  journals: [],
  specialties: [],
  loading: false,
  generating: false,
  error: null,

  fetchPreferences: async () => {
    set({ loading: true, error: null });
    try {
      const prefs = await getPulsePreferences();
      set({ preferences: prefs, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  savePreferences: async (data) => {
    set({ loading: true, error: null });
    try {
      const prefs = await upsertPulsePreferences(data);
      set({ preferences: prefs, loading: false });
      return prefs;
    } catch (e) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  fetchLatestDigest: async () => {
    set({ loading: true, error: null });
    try {
      const digest = await getLatestPulseDigest();
      set({ latestDigest: digest, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  fetchDigests: async (page = 1) => {
    set({ loading: true, error: null });
    try {
      const digests = await listPulseDigests(page);
      set({ digests, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  fetchDigest: async (id) => {
    set({ loading: true, error: null });
    try {
      const digest = await getPulseDigest(id);
      set({ selectedDigest: digest, loading: false });
      return digest;
    } catch (e) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  clearSelectedDigest: () => set({ selectedDigest: null }),

  generate: async () => {
    set({ generating: true, error: null });
    try {
      await triggerPulseDigest();
      set({ generating: false });
    } catch (e) {
      set({ error: e.message, generating: false });
      throw e;
    }
  },

  fetchJournals: async () => {
    try {
      const journals = await getPulseJournals();
      set({ journals });
    } catch (e) {
      set({ error: e.message });
    }
  },

  fetchSpecialties: async () => {
    try {
      const specialties = await getPulseSpecialties();
      set({ specialties });
    } catch (e) {
      set({ error: e.message });
    }
  },
}));

export default usePulseStore;
