import UrgencyBadge from './UrgencyBadge';

const TIER_STYLES = {
  ALERT: 'border-l-red-700 bg-red-50',
  MAJOR: 'border-l-amber-500 bg-white',
  NEW:   'border-l-gray-200 bg-white',
};

export default function HeadlineCard({ headline, onDeepResearch }) {
  const tier = headline.urgency_tier || 'NEW';
  const tierClass = TIER_STYLES[tier] || TIER_STYLES.NEW;

  return (
    <div className={`border border-gray-200 border-l-4 ${tierClass} rounded-lg p-4 transition hover:shadow-md`}>
      {/* Top row: badge + verification */}
      <div className="flex items-center gap-2 flex-wrap">
        <UrgencyBadge tier={tier} reason={headline.urgency_reason} />

        {headline.is_verified && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
            {'\u2705'} Verified
            {headline.citation_count != null && (
              <span className="text-gray-400">
                {'\u00B7'} {headline.citation_count.toLocaleString()} citations
              </span>
            )}
            {headline.quality_tier === 'landmark' && (
              <span className="text-amber-700 font-semibold">{'\u{1F3C6}'} Landmark</span>
            )}
          </span>
        )}
      </div>

      {/* Title */}
      <a
        href={headline.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 text-sm font-semibold text-gray-900 leading-snug hover:text-teal-700 transition"
      >
        {headline.title}
      </a>

      {/* Meta */}
      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
        {headline.source && <span className="text-teal-600 font-medium">{headline.source}</span>}
        {headline.published_at && <span>{headline.published_at}</span>}
      </div>

      {/* Snippet */}
      {headline.snippet && (
        <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-3">
          {headline.snippet}
        </p>
      )}

      {/* Deep Research CTA */}
      {headline.research_topic && onDeepResearch && (
        <button
          onClick={() => onDeepResearch(headline)}
          className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition"
        >
          Deep Research
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      )}
    </div>
  );
}
