import { useState } from 'react';

/**
 * Three-state deep dive card: available → running → complete.
 * Prominent full-width card so users don't miss it.
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
      <div className="rounded-xl border-2 border-green-200 bg-green-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">Deep Literature Research Complete</p>
            <p className="text-xs text-green-600 mt-0.5">
              Report updated to v2 with STORM deep research integrated. Full evidence synthesis applied.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="rounded-xl border-2 border-purple-200 bg-purple-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-purple-800">Deep Literature Research Running...</p>
            <p className="text-xs text-purple-600 mt-0.5">
              STORM is generating a comprehensive literature review. You can keep chatting — the report will update automatically when done.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canTrigger}
      className="w-full text-left rounded-xl border-2 border-purple-200 hover:border-purple-400 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 px-5 py-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center flex-shrink-0 transition">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-purple-800">Generate Deep Literature Research (STORM)</p>
          <p className="text-xs text-purple-600/80 mt-0.5">
            Run autonomous deep research on the primary diagnosis. Takes ~3 minutes. Produces a comprehensive literature review that upgrades the report from v1 to v2.
          </p>
        </div>
        <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </button>
  );
}
