import { useState } from 'react';

const SPECIALTIES = [
  'Cardiology', 'Dermatology', 'Emergency Medicine', 'Endocrinology',
  'Gastroenterology', 'General Medicine', 'Gynaecology', 'Hematology',
  'Hepatology', 'Infectious Disease', 'Nephrology', 'Neurology', 'Oncology',
  'Ophthalmology', 'Orthopaedics', 'Pediatrics', 'Psychiatry', 'Pulmonology',
  'Rheumatology',
];

const MAX = 1;

export default function BreakingOnboarding({ onSave, saving }) {
  const [selected, setSelected] = useState([]);

  function toggle(sp) {
    setSelected((prev) => {
      if (prev.includes(sp)) return prev.filter((s) => s !== sp);
      if (prev.length >= MAX) return prev;
      return [...prev, sp];
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-teal-200 p-8 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Choose your specialty</h2>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Select a specialty to personalize your daily Breaking feed.
      </p>

      <div className="flex flex-wrap gap-2">
        {SPECIALTIES.map((sp) => {
          const isSelected = selected.includes(sp);
          const isDisabled = !isSelected && selected.length >= MAX;

          return (
            <button
              key={sp}
              onClick={() => toggle(sp)}
              disabled={isDisabled}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition
                ${isSelected
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : isDisabled
                    ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
            >
              {sp}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSave(selected)}
        disabled={selected.length === 0 || saving}
        className="mt-6 w-full py-3 rounded-lg bg-teal-600 text-white font-semibold text-sm
                   hover:bg-teal-700 disabled:opacity-40 transition"
      >
        {saving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}
