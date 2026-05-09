import { useState } from 'react';

// Mirrors v1 grade colours; v2 keeps the same evidence_grade vocabulary.
const GRADE_COLORS = {
  'Meta-Analysis': 'bg-emerald-100 text-emerald-800',
  'Systematic Review': 'bg-emerald-100 text-emerald-800',
  'RCT': 'bg-sky-100 text-sky-800',
  'Clinical Trial': 'bg-sky-100 text-sky-800',
  'Cohort Study': 'bg-indigo-100 text-indigo-800',
  'Case-Control': 'bg-indigo-100 text-indigo-800',
  'Guideline': 'bg-amber-100 text-amber-800',
  'Review': 'bg-violet-100 text-violet-800',
  'Case Report': 'bg-slate-100 text-slate-700',
  'Expert Opinion': 'bg-slate-100 text-slate-600',
  'Ungraded': 'bg-slate-50 text-slate-500',
};

const SOURCE_LABELS = {
  pubmed: 'PubMed',
  europe_pmc: 'Europe PMC',
  openalex: 'OpenAlex',
  semantic_scholar: 'Semantic Scholar',
  crossref: 'Crossref',
  biorxiv: 'bioRxiv',
  medrxiv: 'medRxiv',
};

function SourceChip({ source }) {
  const label = SOURCE_LABELS[source] || source;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-[10px] font-medium text-sky-700">
      {label}
    </span>
  );
}

function ArticleItem({ article }) {
  const [expanded, setExpanded] = useState(false);
  const gradeClass = GRADE_COLORS[article.evidence_grade] || GRADE_COLORS['Ungraded'];

  // v2 may populate `sources` (array). v1 only has `source` (string). Handle both.
  const sources =
    Array.isArray(article.sources) && article.sources.length > 0
      ? article.sources
      : article.source
        ? [article.source]
        : [];

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-sky-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-left w-full"
          >
            <h4 className="text-sm font-semibold text-slate-900 leading-snug">
              {article.title}
            </h4>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
          {sources.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">Found in</span>
              {sources.map((s) => (
                <SourceChip key={s} source={s} />
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 mt-1 text-slate-400 hover:text-slate-600"
          aria-label={expanded ? 'Collapse' : 'Expand'}
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
          {article.tldr && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-sky-700 mb-1">TL;DR</p>
              <p className="text-sm text-slate-800 leading-relaxed">{article.tldr}</p>
            </div>
          )}
          {article.abstract && !article.tldr && (
            <p className="text-sm text-slate-700 leading-relaxed line-clamp-6">
              {article.abstract}
            </p>
          )}
          {article.authors && article.authors.length > 0 && (
            <p className="text-xs text-slate-500">
              {article.authors.slice(0, 5).join(', ')}
              {article.authors.length > 5 && ' et al.'}
            </p>
          )}
          <div className="flex gap-3">
            {article.pmid && (
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-sky-600 hover:text-sky-800"
              >
                PubMed
              </a>
            )}
            {article.doi && (
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-sky-600 hover:text-sky-800"
              >
                Full Text (DOI)
              </a>
            )}
            {article.article_url && !article.doi && !article.pmid && (
              <a
                href={article.article_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-sky-600 hover:text-sky-800"
              >
                Open
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PulseV2DigestCard({ digest, title = 'Digest' }) {
  if (!digest) return null;

  const dateRange = [digest.date_range_start, digest.date_range_end]
    .filter(Boolean)
    .map((d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    .join(' — ');

  // Aggregate sources used across the digest's articles for a header summary.
  const sourceTally = {};
  (digest.articles || []).forEach((a) => {
    const list = Array.isArray(a.sources) ? a.sources : a.source ? [a.source] : [];
    list.forEach((s) => { sourceTally[s] = (sourceTally[s] || 0) + 1; });
  });
  const sourceEntries = Object.entries(sourceTally).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {digest.specialty_used && (
                <span className="font-medium text-slate-700">{digest.specialty_used}</span>
              )}
              {dateRange && <span className="ml-2">{dateRange}</span>}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold">
            {digest.article_count} article{digest.article_count !== 1 ? 's' : ''}
          </span>
        </div>

        {digest.topics_used && digest.topics_used.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {digest.topics_used.map((topic, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                {topic}
              </span>
            ))}
          </div>
        )}

        {sourceEntries.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Sources</span>
            {sourceEntries.map(([s, count]) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-medium text-emerald-700"
              >
                {SOURCE_LABELS[s] || s}
                <span className="text-emerald-500">·{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4 space-y-3">
        {digest.articles && digest.articles.length > 0 ? (
          digest.articles.map((article) => (
            <ArticleItem key={article.id || `${article.pmid || ''}:${article.doi || article.title}`} article={article} />
          ))
        ) : (
          <p className="text-sm text-slate-500 text-center py-4">
            No articles found for this digest period.
          </p>
        )}
      </div>
    </div>
  );
}
