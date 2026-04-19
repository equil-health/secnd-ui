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
      <div className="relative overflow-hidden rounded-xl bg-white border border-emerald-200 shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
        <div className="px-5 py-4 pl-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Deep literature research complete</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Report upgraded to v2 with autonomous literature synthesis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-white border border-indigo-200 shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
        <div className="px-5 py-4 pl-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Deep literature research running</p>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Keep chatting — the report will upgrade automatically when finished.
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
      className="group relative overflow-hidden w-full text-left rounded-xl bg-slate-950 text-white px-5 py-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/20"
    >
      <div
        className="absolute inset-0 opacity-40 transition-opacity group-hover:opacity-60"
        style={{
          backgroundImage: 'radial-gradient(ellipse at right, rgba(99,102,241,0.35), transparent 55%)',
        }}
      />
      <div className="relative flex items-center gap-4">
        <div className="w-10 h-10 rounded-md bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur">
          <svg className="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">Run Deep Literature Research</p>
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded">
              v2 upgrade
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Autonomous literature review on the primary diagnosis. Takes about 3 minutes.
          </p>
        </div>
        <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-all flex-shrink-0 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </button>
  );
}
