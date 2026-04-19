import { useState } from 'react';

const STAGE_LABELS = {
  image_analysis: 'Image Analysis',
  p1_medgemma: 'Initial Differential',
  guard: 'Hallucination Guard',
  claim_extraction: 'Claim Extraction',
  serper: 'Evidence Search',
  openalex: 'Citation Verification',
  evidence_synthesis: 'Evidence Synthesis',
  storm: 'Deep Literature Research',
  extraction: 'Triplet Extraction',
  p2_verify: 'Knowledge Graph Verification',
  synthesis: 'Final Synthesis',
  final: 'Pipeline Summary',
};

const STAGE_ORDER = [
  'image_analysis', 'p1_medgemma', 'guard', 'claim_extraction',
  'serper', 'openalex', 'evidence_synthesis', 'storm',
  'extraction', 'p2_verify', 'synthesis', 'final',
];

function StageCard({ name, data }) {
  const [expanded, setExpanded] = useState(false);
  const label = STAGE_LABELS[name] || name;
  const duration = data.duration_ms || data.total_duration_ms;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            data.error ? 'bg-red-500' : 'bg-green-500'
          }`} />
          <span className="text-sm font-medium text-gray-800">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {duration != null && (
            <span className="text-xs text-gray-500 font-mono">
              {duration >= 60000
                ? `${Math.floor(duration / 60000)}m ${Math.round((duration % 60000) / 1000)}s`
                : `${(duration / 1000).toFixed(1)}s`}
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 border-t bg-white">
          <StageDetail name={name} data={data} />
        </div>
      )}
    </div>
  );
}

function StageDetail({ name, data }) {
  // Specialized renderers for each stage
  if (name === 'final') {
    return (
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total Duration" value={fmtMs(data.total_duration_ms)} />
          <Stat label="Total Tokens In" value={data.total_tokens_in || 0} />
          <Stat label="Total Tokens Out" value={data.total_tokens_out || 0} />
          <Stat label="Est. Cost" value={data.estimated_cost_usd != null ? `$${data.estimated_cost_usd.toFixed(4)}` : '—'} />
          <Stat label="Top Diagnosis" value={data.top_diagnosis || '—'} />
          <Stat label="Evidence Count" value={data.evidence_count || 0} />
          <Stat label="Hypotheses" value={data.num_hypotheses || 0} />
          <Stat label="Images" value={data.num_images || 0} />
          <Stat label="Critical Flags" value={data.has_critical_flags ? 'YES' : 'No'} />
        </div>
        {data.verification_stats && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
            <p className="font-medium mb-1">Citation Verification:</p>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(data.verification_stats).map(([k, v]) => (
                <span key={k}><span className="text-gray-500">{k}:</span> {v}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (name === 'image_analysis' && data.images) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">{data.num_images} image(s) processed</p>
        {data.images.map((img, i) => (
          <div key={i} className="p-2 bg-gray-50 rounded text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{img.filename}</span>
              <span className="text-gray-400">({img.image_type})</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                img.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{img.status}</span>
            </div>
            {img.analysis && (
              <p className="text-gray-600 whitespace-pre-wrap">{img.analysis}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (name === 'p2_verify' && data.per_triplet) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          {data.total_triplets} triplets verified, {data.error_count} errors
        </p>
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-1">Head</th><th className="pb-1">Relation</th><th className="pb-1">Tail</th>
                <th className="pb-1">Answer</th><th className="pb-1">Adapter</th>
              </tr>
            </thead>
            <tbody>
              {data.per_triplet.map((t, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-1">{t.head}</td>
                  <td className="py-1 text-gray-500">{t.relation}</td>
                  <td className="py-1">{t.tail}</td>
                  <td className="py-1">
                    <span className={`px-1 rounded ${
                      t.answer === 'True' ? 'bg-green-100 text-green-700'
                      : t.answer === 'False' ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>{t.answer}</span>
                  </td>
                  <td className="py-1 text-gray-400">{t.adapter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (name === 'serper') {
    return (
      <div className="space-y-2 text-xs">
        <Stat label="Primary Diagnosis" value={data.primary_diagnosis} />
        <Stat label="Results" value={data.num_results} />
        {data.queries_sent?.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Queries Sent:</p>
            <ol className="list-decimal ml-4 space-y-0.5 text-gray-600">
              {data.queries_sent.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (name === 'guard') {
    return (
      <div className="space-y-2 text-xs">
        <Stat label="Quality" value={data.overall_quality} />
        <Stat label="Issues Found" value={data.issues_found} />
        {data.issues?.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Issues:</p>
            {data.issues.map((issue, i) => (
              <div key={i} className="p-2 bg-amber-50 rounded mb-1">
                <p><span className="text-gray-500">Type:</span> {issue.type}</p>
                <p><span className="text-gray-500">Original:</span> {issue.original_text}</p>
                <p><span className="text-gray-500">Correction:</span> {issue.correction}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generic fallback: render all key-value pairs
  return (
    <div className="space-y-1 text-xs">
      {Object.entries(data).map(([key, value]) => {
        if (value == null) return null;
        const isLong = typeof value === 'string' && value.length > 200;
        const isObj = typeof value === 'object';
        return (
          <div key={key}>
            <span className="text-gray-500">{key}:</span>{' '}
            {isObj ? (
              <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto max-h-40 text-[11px]">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : isLong ? (
              <details className="inline">
                <summary className="cursor-pointer text-indigo-600">
                  {String(value).slice(0, 80)}...
                </summary>
                <pre className="mt-1 p-2 bg-gray-50 rounded whitespace-pre-wrap text-[11px]">{value}</pre>
              </details>
            ) : (
              <span className="text-gray-800">{String(value)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

function fmtMs(ms) {
  if (!ms) return '—';
  return ms >= 60000
    ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;
}

export default function AuditReportViewer({ audit }) {
  if (!audit || !audit.stages) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No audit data available for this analysis.</p>
        <p className="text-xs mt-1">Audit reports are generated for analyses run after April 3, 2026.</p>
      </div>
    );
  }

  const stages = audit.stages;
  const ordered = STAGE_ORDER.filter(s => stages[s]);
  // Add any stages not in our predefined order
  const extra = Object.keys(stages).filter(s => !STAGE_ORDER.includes(s));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Pipeline Audit Trail</h3>
          <p className="text-xs text-gray-500">
            Case: {audit.case_id} | Mode: {audit.mode} | Started: {new Date(audit.started_at).toLocaleString()}
          </p>
        </div>
        {stages.final?.estimated_cost_usd != null && (
          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded">
            Est. Cost: ${stages.final.estimated_cost_usd.toFixed(4)}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {[...ordered, ...extra].map(name => (
          <StageCard key={name} name={name} data={stages[name]} />
        ))}
      </div>
    </div>
  );
}
