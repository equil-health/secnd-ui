import { useState } from 'react';

const GRADE_COLORS = {
  'Meta-Analysis': 'bg-green-100 text-green-800',
  'Systematic Review': 'bg-green-100 text-green-800',
  'RCT': 'bg-blue-100 text-blue-800',
  'Clinical Trial': 'bg-blue-100 text-blue-800',
  'Cohort Study': 'bg-indigo-100 text-indigo-800',
  'Case-Control': 'bg-indigo-100 text-indigo-800',
  'Guideline': 'bg-amber-100 text-amber-800',
  'Review': 'bg-purple-100 text-purple-800',
  'Case Report': 'bg-gray-100 text-gray-700',
  'Expert Opinion': 'bg-gray-100 text-gray-600',
  'Ungraded': 'bg-gray-50 text-gray-500',
};

function ArticleItem({ article }) {
  const [expanded, setExpanded] = useState(false);
  const gradeClass = GRADE_COLORS[article.evidence_grade] || GRADE_COLORS['Ungraded'];

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-amber-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-left w-full"
          >
            <h4 className="text-sm font-semibold text-gray-900 leading-snug">
              {article.title}
            </h4>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {article.journal && <span>{article.journal}</span>}
            {article.published_date && (
              <span>
                {new Date(article.published_date).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </span>
            )}
            {article.evidence_grade && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${gradeClass}`}>
                {article.evidence_grade}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 mt-1 text-gray-400 hover:text-gray-600"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in-up">
          {/* TL;DR */}
          {article.tldr && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">TL;DR</p>
              <p className="text-sm text-gray-800 leading-relaxed">{article.tldr}</p>
            </div>
          )}

          {/* Authors */}
          {article.authors && article.authors.length > 0 && (
            <p className="text-xs text-gray-500">
              {article.authors.slice(0, 5).join(', ')}
              {article.authors.length > 5 && ' et al.'}
            </p>
          )}

          {/* Links */}
          <div className="flex gap-3">
            {article.pmid && (
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-amber-600 hover:text-amber-800"
              >
                PubMed
              </a>
            )}
            {article.doi && (
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-amber-600 hover:text-amber-800"
              >
                Full Text (DOI)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PulseDigestCard({ digest }) {
  if (!digest) return null;

  const dateRange = [digest.date_range_start, digest.date_range_end]
    .filter(Boolean)
    .map((d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    .join(' — ');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Latest Digest</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {digest.specialty_used && <span className="font-medium text-gray-700">{digest.specialty_used}</span>}
              {dateRange && <span className="ml-2">{dateRange}</span>}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            {digest.article_count} article{digest.article_count !== 1 ? 's' : ''}
          </span>
        </div>
        {digest.topics_used && digest.topics_used.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {digest.topics_used.map((topic, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Articles */}
      <div className="px-6 py-4 space-y-3">
        {digest.articles && digest.articles.length > 0 ? (
          digest.articles.map((article) => (
            <ArticleItem key={article.id} article={article} />
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No articles found for this digest period.
          </p>
        )}
      </div>
    </div>
  );
}
