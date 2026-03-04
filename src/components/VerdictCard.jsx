import { useState } from 'react';

const VERDICT_COLORS = {
  SUPPORTED: 'bg-green-100 text-green-800 border-green-300',
  PARTIALLY_SUPPORTED: 'bg-amber-100 text-amber-800 border-amber-300',
  CONTRADICTED: 'bg-red-100 text-red-800 border-red-300',
  INSUFFICIENT_EVIDENCE: 'bg-slate-100 text-slate-700 border-slate-300',
};

function confidenceColor(score) {
  if (score >= 80) return 'bg-green-500 text-white';
  if (score >= 50) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

export default function VerdictCard({ claim }) {
  const [expanded, setExpanded] = useState(false);
  const verdict = claim.verdict?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN';
  const colors = VERDICT_COLORS[verdict] || 'bg-gray-100 text-gray-800 border-gray-300';

  const confidence = claim.confidence_score ?? claim.confidence ?? null;

  return (
    <div className="border rounded-lg p-4 bg-white">
      {/* Claim text */}
      <p className="text-sm text-gray-800 font-medium">{claim.claim}</p>

      {/* Verdict badge + confidence */}
      <div className="flex items-center gap-2 mt-2">
        <span
          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${colors}`}
        >
          {claim.verdict}
        </span>

        {confidence != null && (
          <span
            className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${confidenceColor(confidence)}`}
          >
            {confidence}%
          </span>
        )}
      </div>

      {/* Evidence */}
      {claim.evidence && (
        <p className="mt-2 text-sm text-gray-600">{claim.evidence}</p>
      )}

      {/* Expandable sources */}
      {claim.references?.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            {expanded ? 'Hide' : 'Show'} sources ({claim.references.length})
          </button>
          {expanded && (
            <ul className="mt-1 space-y-0.5">
              {claim.references.map((refId) => (
                <li key={refId}>
                  <a
                    href={`#ref-${refId}`}
                    className="text-xs text-indigo-500 hover:underline"
                  >
                    [{refId}]
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
