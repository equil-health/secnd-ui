import { useEffect } from 'react';
import useSdssV2Store from '../../stores/sdssV2Store';
import { getCaseAudit, STAGE_LABELS } from '../../utils/sdssV2Api';

function formatMs(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AuditPanel() {
  const caseId = useSdssV2Store((s) => s.caseId);
  const audit = useSdssV2Store((s) => s.audit);
  const auditOpen = useSdssV2Store((s) => s.auditOpen);
  const setAudit = useSdssV2Store((s) => s.setAudit);
  const toggleAudit = useSdssV2Store((s) => s.toggleAudit);

  // Fetch audit on open
  useEffect(() => {
    if (auditOpen && caseId && !audit) {
      getCaseAudit(caseId).then(setAudit).catch(() => {});
    }
  }, [auditOpen, caseId, audit, setAudit]);

  if (!auditOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in-up" onClick={toggleAudit} />

      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto border-l border-slate-200">
        {/* Dark header */}
        <div className="sticky top-0 z-10 bg-slate-950 border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <h2 className="text-xs font-semibold text-white uppercase tracking-[0.22em]">Audit Trail</h2>
          </div>
          <button
            onClick={toggleAudit}
            className="text-slate-400 hover:text-white transition p-1 -mr-1"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {!audit ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">Loading audit trail…</p>
            </div>
          ) : (
            <>
              {/* Summary card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Case ID</span>
                  <span className="text-[10px] font-mono text-slate-700 truncate">{audit.case_id}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Mode</span>
                  <span className="text-[10px] font-mono text-slate-700">{audit.mode}</span>
                </div>
                {audit.final && (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Total time</span>
                      <span className="text-[10px] font-mono text-slate-900 font-semibold">{formatMs(audit.final.total_duration_ms)}</span>
                    </div>
                    {audit.final.estimated_cost_usd != null && (
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Est. cost</span>
                        <span className="text-[10px] font-mono text-slate-900 font-semibold">${audit.final.estimated_cost_usd.toFixed(3)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Phase A */}
              {audit.phase_a && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1 h-1 rounded-full bg-indigo-500" />
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Phase A · Verification
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(audit.phase_a).map(([stage, data]) => (
                      <AuditStageCard key={stage} stage={stage} data={data} />
                    ))}
                  </div>
                </div>
              )}

              {/* Phase B */}
              {audit.phase_b && Object.keys(audit.phase_b).length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Phase B · Deep Dive
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(audit.phase_b).map(([stage, data]) => (
                      <AuditStageCard key={stage} stage={stage} data={data} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditStageCard({ stage, data }) {
  const label = STAGE_LABELS[stage] || stage;
  const entries = Object.entries(data || {}).filter(
    ([k]) => !['raw_output', 'prompt_sent', 'per_triplet'].includes(k)
  );

  return (
    <details className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition">
      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-slate-50 transition list-none">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-xs font-semibold text-slate-700 truncate">{label}</span>
        </div>
        {data?.duration_ms != null && (
          <span className="text-[10px] text-slate-400 tabular-nums font-mono flex-shrink-0">{formatMs(data.duration_ms)}</span>
        )}
      </summary>
      <div className="px-3 py-2 border-t border-slate-100 space-y-1 bg-slate-50/50">
        {entries.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic">No detailed data available</p>
        ) : (
          entries.map(([key, val]) => (
            <div key={key} className="text-[11px] leading-snug">
              <span className="font-semibold text-slate-700">{key}:</span>{' '}
              <span className="text-slate-500 break-words">
                {typeof val === 'object' ? JSON.stringify(val, null, 0) : String(val)}
              </span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
