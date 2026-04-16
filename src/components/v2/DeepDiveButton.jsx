import { useState } from 'react';

/**
 * Three-state deep dive button: available → running → complete.
 */
export default function DeepDiveButton({ status, onTrigger }) {
  const [triggering, setTriggering] = useState(false);

  const isRunning = status === 'running_phase_b' || triggering;
  const isComplete = status === 'phase_b_complete';
  const canTrigger = status === 'phase_a_complete' && !triggering;

  async function handleClick() {
    if (!canTrigger) return;
    setTriggering(true);
    try {
      await onTrigger();
    } catch {
      setTriggering(false);
    }
  }

  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Deep dive complete
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-medium">
        <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        Deep dive running...
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canTrigger}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
      Deep Dive
    </button>
  );
}
