import VerdictCard from './VerdictCard';
import FormattedMarkdown from '../utils/formatReport';

/**
 * EvidenceVerdictPanel — displays individual claim verdicts
 * and the full evidence synthesis markdown.
 */
export default function EvidenceVerdictPanel({ claims, synthesis }) {
  return (
    <div className="space-y-4">
      {/* Individual claim verdicts */}
      {claims?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Claim Verdicts ({claims.length})
          </h4>
          {claims.map((claim, i) => (
            <VerdictCard key={i} claim={claim} />
          ))}
        </div>
      )}

      {/* Full synthesis */}
      {synthesis && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Evidence Synthesis
          </h4>
          <div className="prose prose-sm max-w-none">
            <FormattedMarkdown content={synthesis} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!claims || claims.length === 0) && !synthesis && (
        <p className="text-sm text-gray-400">No evidence data available.</p>
      )}
    </div>
  );
}
