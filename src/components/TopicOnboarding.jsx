import { useState } from 'react';

const MAX_TOPICS_PER_SPECIALTY = 3;

export default function TopicOnboarding({ specialties, onSave, saving }) {
  // { "Cardiology": ["HFpEF", "ATTR cardiomyopathy"], ... }
  const [topics, setTopics] = useState(() =>
    Object.fromEntries(specialties.map((sp) => [sp, []]))
  );
  const [input, setInput] = useState(() =>
    Object.fromEntries(specialties.map((sp) => [sp, '']))
  );

  function addTopic(sp) {
    const text = (input[sp] || '').trim();
    if (!text || text.length < 3) return;
    if ((topics[sp] || []).length >= MAX_TOPICS_PER_SPECIALTY) return;

    setTopics((prev) => ({
      ...prev,
      [sp]: [...(prev[sp] || []), text],
    }));
    setInput((prev) => ({ ...prev, [sp]: '' }));
  }

  function removeTopic(sp, idx) {
    setTopics((prev) => ({
      ...prev,
      [sp]: prev[sp].filter((_, i) => i !== idx),
    }));
  }

  function handleKeyDown(sp, e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic(sp);
    }
  }

  const hasAnyTopics = Object.values(topics).some((arr) => arr.length > 0);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-teal-200 p-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900">
        Personalise your Breaking feed
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Add up to 3 clinical topics per specialty. These help us find the most
        relevant headlines for you.
      </p>

      <div className="space-y-6">
        {specialties.map((sp) => (
          <div key={sp}>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">{sp}</h3>

            {/* Existing topic chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(topics[sp] || []).map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs
                             font-medium bg-teal-50 text-teal-700 border border-teal-200"
                >
                  {t}
                  <button
                    onClick={() => removeTopic(sp, idx)}
                    className="ml-0.5 text-teal-400 hover:text-teal-600"
                    aria-label={`Remove ${t}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            {/* Input for new topic */}
            {(topics[sp] || []).length < MAX_TOPICS_PER_SPECIALTY && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input[sp] || ''}
                  onChange={(e) =>
                    setInput((prev) => ({ ...prev, [sp]: e.target.value }))
                  }
                  onKeyDown={(e) => handleKeyDown(sp, e)}
                  placeholder="e.g. HFpEF, ATTR cardiomyopathy..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg
                             focus:outline-none focus:border-teal-400"
                  maxLength={200}
                />
                <button
                  onClick={() => addTopic(sp)}
                  className="px-3 py-1.5 text-sm font-medium text-teal-600
                             border border-teal-300 rounded-lg hover:bg-teal-50"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onSave({})}
          disabled={saving}
          className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-500
                     font-medium text-sm hover:bg-gray-50 disabled:opacity-40 transition"
        >
          Skip for now
        </button>
        <button
          onClick={() => onSave(topics)}
          disabled={saving || !hasAnyTopics}
          className="flex-1 py-3 rounded-lg bg-teal-600 text-white font-semibold text-sm
                     hover:bg-teal-700 disabled:opacity-40 transition"
        >
          {saving ? 'Saving...' : 'Save topics'}
        </button>
      </div>
    </div>
  );
}
