import { useState } from 'react';

const VERDICT_COLORS = {
  SUPPORTED: 'bg-green-100 text-green-800 border-green-300',
  PARTIALLY_SUPPORTED: 'bg-amber-100 text-amber-800 border-amber-300',
  CONTRADICTED: 'bg-red-100 text-red-800 border-red-300',
};

export default function VerdictCard({ claim }) {
  const [expanded, setExpanded] = useState(false);
  const verdict = claim.verdict?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN';
  const colors = VERDICT_COLORS[verdict] || 'bg-gray-100 text-gray-800 border-gray-300';

  return (
    <div className="border rounded-lg p-4 bg-white">
      {/* Claim text */}
      <p className="text-sm text-gray-800 font-medium">{claim.claim}</p>

      {/* Verdict badge */}
      <span
        className={`inline-block mt-2 px-2 py-0.5 text-xs font-semibold rounded border ${colors}`}
      >
        {claim.verdict}
      </span>

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
