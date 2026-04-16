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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={toggleAudit} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-sm font-bold text-gray-800">Audit Trail</h2>
          <button onClick={toggleAudit} className="text-gray-400 hover:text-gray-700 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {!audit ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading audit trail...</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 space-y-1">
                <p><span className="font-medium">Case:</span> {audit.case_id}</p>
                <p><span className="font-medium">Mode:</span> {audit.mode}</p>
                {audit.final && (
                  <>
                    <p><span className="font-medium">Total time:</span> {formatMs(audit.final.total_duration_ms)}</p>
                    <p><span className="font-medium">Est. cost:</span> ${audit.final.estimated_cost_usd?.toFixed(3)}</p>
                  </>
                )}
              </div>

              {/* Phase A stages */}
              {audit.phase_a && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Phase A — Verification</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.phase_a).map(([stage, data]) => (
                      <AuditStageCard key={stage} stage={stage} data={data} />
                    ))}
                  </div>
                </div>
              )}

              {/* Phase B */}
              {audit.phase_b && Object.keys(audit.phase_b).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Phase B — Deep Dive</h3>
                  <div className="space-y-2">
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

  // Extract displayable fields (skip raw_output and other large fields)
  const entries = Object.entries(data || {}).filter(
    ([k]) => !['raw_output', 'prompt_sent', 'per_triplet'].includes(k)
  );

  return (
    <details className="group bg-white border border-gray-200 rounded-lg overflow-hidden">
      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        {data?.duration_ms != null && (
          <span className="text-[10px] text-gray-400 tabular-nums">{formatMs(data.duration_ms)}</span>
        )}
      </summary>
      <div className="px-3 py-2 border-t border-gray-100 space-y-1">
        {entries.length === 0 ? (
          <p className="text-[10px] text-gray-400">No detailed data available</p>
        ) : (
          entries.map(([key, val]) => (
            <div key={key} className="text-[11px]">
              <span className="font-medium text-gray-600">{key}:</span>{' '}
              <span className="text-gray-500">
                {typeof val === 'object' ? JSON.stringify(val, null, 0) : String(val)}
              </span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
