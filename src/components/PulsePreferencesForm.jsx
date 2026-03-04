import { useState, useEffect } from 'react';
import usePulseStore from '../stores/pulseStore';
import useToastStore from '../stores/toastStore';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export default function PulsePreferencesForm({ onSaved }) {
  const { preferences, specialties, journals, fetchSpecialties, fetchJournals, savePreferences, loading } = usePulseStore();
  const addToast = useToastStore((s) => s.addToast);

  const [specialty, setSpecialty] = useState('');
  const [topics, setTopics] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [enabledJournals, setEnabledJournals] = useState([]);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    fetchSpecialties();
    fetchJournals();
  }, []);

  useEffect(() => {
    if (preferences) {
      setSpecialty(preferences.specialty || '');
      setTopics((preferences.topics || []).join(', '));
      setFrequency(preferences.frequency || 'weekly');
      setEnabledJournals(preferences.enabled_journals || []);
      setIsEnabled(preferences.is_enabled !== false);
    }
  }, [preferences]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!specialty) {
      addToast('Please select a specialty', 'error');
      return;
    }
    try {
      await savePreferences({
        specialty,
        topics: topics.split(',').map((t) => t.trim()).filter(Boolean),
        frequency,
        is_enabled: isEnabled,
        enabled_journals: enabledJournals.length > 0 ? enabledJournals : null,
      });
      addToast('Preferences saved!', 'success');
      onSaved?.();
    } catch (err) {
      addToast(err.message || 'Failed to save preferences', 'error');
    }
  }

  function toggleJournal(key) {
    setEnabledJournals((prev) =>
      prev.includes(key) ? prev.filter((j) => j !== key) : [...prev, key]
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Specialty */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
        >
          <option value="">Select a specialty...</option>
          {specialties.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Topics */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Topics <span className="text-gray-400 font-normal">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="e.g. heart failure, SGLT2 inhibitors, atrial fibrillation"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-amber-500"
        />
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
        <div className="flex gap-2">
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFrequency(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                frequency === opt.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Journals */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Journals <span className="text-gray-400 font-normal">(optional — leave empty for all)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {journals.map((j) => (
            <label
              key={j.key}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={enabledJournals.includes(j.key)}
                onChange={() => toggleJournal(j.key)}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              {j.name}
            </label>
          ))}
        </div>
      </div>

      {/* Enabled toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        Enable automatic digest generation
      </label>

      {/* Save */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving...' : 'Save Preferences'}
      </button>
    </form>
  );
}
