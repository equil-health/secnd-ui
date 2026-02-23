const TIER_BADGES = {
  landmark: { label: 'Landmark', bg: 'bg-amber-100', text: 'text-amber-800' },
  strong: { label: 'Strong', bg: 'bg-green-100', text: 'text-green-800' },
  'peer-reviewed': { label: 'Peer-reviewed', bg: 'bg-blue-100', text: 'text-blue-800' },
  preprint: { label: 'Preprint', bg: 'bg-gray-100', text: 'text-gray-600' },
  guideline: { label: 'Guideline', bg: 'bg-teal-100', text: 'text-teal-800' },
  retracted: { label: 'RETRACTED', bg: 'bg-red-100', text: 'text-red-700 font-bold' },
  unverified: { label: 'Unverified', bg: 'bg-gray-50', text: 'text-gray-500' },
};

export default function ReferenceList({ references }) {
  if (!references || references.length === 0) return null;

  return (
    <div className="bg-white border rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        References
      </h4>
      <ul className="space-y-3 max-h-80 overflow-y-auto">
        {references.map((ref) => (
          <li key={ref.id} id={`ref-${ref.id}`} className="text-sm">
            {/* Retraction banner */}
            {ref.is_retracted && (
              <div className="bg-red-50 border border-red-200 rounded px-2 py-1 mb-1 text-xs text-red-700 font-semibold">
                RETRACTED — Findings excluded from analysis
              </div>
            )}

            <div className="flex items-start gap-1.5">
              <span className="text-indigo-600 font-medium shrink-0">[{ref.id}]</span>
              <div className="min-w-0">
                {ref.url ? (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline ${ref.is_retracted ? 'text-red-600 line-through' : 'text-gray-800 hover:text-indigo-600'}`}
                  >
                    {ref.title || ref.url}
                  </a>
                ) : (
                  <span className="text-gray-800">{ref.title}</span>
                )}

                {/* Journal + year */}
                {(ref.journal || ref.year) && (
                  <span className="text-xs text-gray-500 ml-1">
                    {ref.journal && <em>{ref.journal}</em>}
                    {ref.journal && ref.year && ', '}
                    {ref.year}
                  </span>
                )}

                {/* Quality tier badge + citation count */}
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {ref.quality_tier && TIER_BADGES[ref.quality_tier] && (
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full ${TIER_BADGES[ref.quality_tier].bg} ${TIER_BADGES[ref.quality_tier].text}`}>
                      {TIER_BADGES[ref.quality_tier].label}
                    </span>
                  )}
                  {ref.citation_count > 0 && (
                    <span className="text-[10px] text-gray-400">
                      Cited {ref.citation_count} times
                    </span>
                  )}
                  {ref.is_oa && ref.oa_url && (
                    <a
                      href={ref.oa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-green-600 hover:underline"
                    >
                      Open Access
                    </a>
                  )}
                </div>

                {ref.snippet && !ref.is_retracted && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                    {ref.snippet}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
