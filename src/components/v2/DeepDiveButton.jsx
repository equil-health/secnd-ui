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
      <div className="relative overflow-hidden rounded-xl bg-white border border-sky-200 shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500" />
        <div className="px-5 py-4 pl-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Deep literature research running</p>
            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
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
      className="group relative overflow-hidden w-full text-left rounded-xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 border border-slate-200 px-5 py-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:border-slate-300"
    >
      <div
        className="absolute inset-0 opacity-70 transition-opacity group-hover:opacity-90"
        style={{
          backgroundImage: 'radial-gradient(ellipse at right, rgba(125,211,252,0.4), transparent 55%), radial-gradient(ellipse at left, rgba(167,243,208,0.3), transparent 55%)',
        }}
      />
      <div className="relative flex items-center gap-4">
        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-500/20">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">Run Deep Literature Research</p>
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
              v2 upgrade
            </span>
          </div>
          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
            Autonomous literature review on the primary diagnosis. Takes about 3 minutes.
          </p>
        </div>
        <svg className="w-5 h-5 text-slate-500 group-hover:text-slate-900 transition-all flex-shrink-0 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </div>
    </button>
  );
}
