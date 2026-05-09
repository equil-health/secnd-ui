import { useState } from 'react';

// Evidence grade → Material-style tonal pairing (background / text / border)
const GRADE_STYLES = {
  'Meta-Analysis':     { bg: 'bg-emerald-50',  text: 'text-emerald-800',  ring: 'ring-emerald-200',  dot: 'bg-emerald-500' },
  'Systematic Review': { bg: 'bg-emerald-50',  text: 'text-emerald-800',  ring: 'ring-emerald-200',  dot: 'bg-emerald-500' },
  'RCT':               { bg: 'bg-sky-50',      text: 'text-sky-800',      ring: 'ring-sky-200',      dot: 'bg-sky-500' },
  'Clinical Trial':    { bg: 'bg-sky-50',      text: 'text-sky-800',      ring: 'ring-sky-200',      dot: 'bg-sky-500' },
  'Cohort Study':      { bg: 'bg-indigo-50',   text: 'text-indigo-800',   ring: 'ring-indigo-200',   dot: 'bg-indigo-500' },
  'Case-Control':      { bg: 'bg-indigo-50',   text: 'text-indigo-800',   ring: 'ring-indigo-200',   dot: 'bg-indigo-500' },
  'Guideline':         { bg: 'bg-amber-50',    text: 'text-amber-800',    ring: 'ring-amber-200',    dot: 'bg-amber-500' },
  'Review':            { bg: 'bg-violet-50',   text: 'text-violet-800',   ring: 'ring-violet-200',   dot: 'bg-violet-500' },
  'Case Report':       { bg: 'bg-slate-100',   text: 'text-slate-700',    ring: 'ring-slate-200',    dot: 'bg-slate-400' },
  'Expert Opinion':    { bg: 'bg-slate-100',   text: 'text-slate-600',    ring: 'ring-slate-200',    dot: 'bg-slate-400' },
  'Ungraded':          { bg: 'bg-slate-50',    text: 'text-slate-500',    ring: 'ring-slate-200',    dot: 'bg-slate-300' },
};

// Per-source identity — left rail color + chip color so the eye can track
// provenance at a glance.
const SOURCE_META = {
  pubmed:           { label: 'PubMed',           rail: 'bg-sky-400',     chipBg: 'bg-sky-50',     chipText: 'text-sky-700',     chipRing: 'ring-sky-200' },
  europe_pmc:       { label: 'Europe PMC',       rail: 'bg-emerald-400', chipBg: 'bg-emerald-50', chipText: 'text-emerald-700', chipRing: 'ring-emerald-200' },
  openalex:         { label: 'OpenAlex',         rail: 'bg-violet-400',  chipBg: 'bg-violet-50',  chipText: 'text-violet-700',  chipRing: 'ring-violet-200' },
  openalex_lit:     { label: 'OpenAlex Lit',     rail: 'bg-violet-400',  chipBg: 'bg-violet-50',  chipText: 'text-violet-700',  chipRing: 'ring-violet-200' },
  semantic_scholar: { label: 'Semantic Scholar', rail: 'bg-amber-400',   chipBg: 'bg-amber-50',   chipText: 'text-amber-700',   chipRing: 'ring-amber-200' },
  crossref:         { label: 'Crossref',         rail: 'bg-rose-400',    chipBg: 'bg-rose-50',    chipText: 'text-rose-700',    chipRing: 'ring-rose-200' },
  core:             { label: 'CORE',             rail: 'bg-teal-400',    chipBg: 'bg-teal-50',    chipText: 'text-teal-700',    chipRing: 'ring-teal-200' },
  doaj:             { label: 'DOAJ',             rail: 'bg-cyan-400',    chipBg: 'bg-cyan-50',    chipText: 'text-cyan-700',    chipRing: 'ring-cyan-200' },
  pmc:              { label: 'PMC',              rail: 'bg-sky-400',     chipBg: 'bg-sky-50',     chipText: 'text-sky-700',     chipRing: 'ring-sky-200' },
  dblp:             { label: 'DBLP',             rail: 'bg-slate-400',   chipBg: 'bg-slate-50',   chipText: 'text-slate-700',   chipRing: 'ring-slate-200' },
  hal:              { label: 'HAL',              rail: 'bg-fuchsia-400', chipBg: 'bg-fuchsia-50', chipText: 'text-fuchsia-700', chipRing: 'ring-fuchsia-200' },
  arxiv:            { label: 'arXiv',            rail: 'bg-orange-400',  chipBg: 'bg-orange-50',  chipText: 'text-orange-700',  chipRing: 'ring-orange-200' },
  biorxiv:          { label: 'bioRxiv',          rail: 'bg-lime-400',    chipBg: 'bg-lime-50',    chipText: 'text-lime-700',    chipRing: 'ring-lime-200' },
  medrxiv:          { label: 'medRxiv',          rail: 'bg-lime-400',    chipBg: 'bg-lime-50',    chipText: 'text-lime-700',    chipRing: 'ring-lime-200' },
};

const SOURCE_FALLBACK = {
  label: 'Unknown', rail: 'bg-slate-300', chipBg: 'bg-slate-50', chipText: 'text-slate-600', chipRing: 'ring-slate-200',
};

function metaFor(source) {
  return SOURCE_META[source] || SOURCE_FALLBACK;
}

function SourceChip({ source }) {
  const m = metaFor(source);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ring-inset text-[10px] font-medium ${m.chipBg} ${m.chipText} ${m.chipRing}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.rail}`} />
      {m.label}
    </span>
  );
}

function GradePill({ grade }) {
  if (!grade) return null;
  const s = GRADE_STYLES[grade] || GRADE_STYLES['Ungraded'];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-semibold ${s.bg} ${s.text} ${s.ring}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {grade}
    </span>
  );
}

function formatDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

function ArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false);

  const sources =
    Array.isArray(article.sources) && article.sources.length > 0
      ? article.sources
      : article.source ? [article.source] : [];
  const primary = sources[0] || 'unknown';
  const railMeta = metaFor(primary);

  const dateLabel = formatDate(article.published_date);
  const authorList = Array.isArray(article.authors) ? article.authors : [];
  const authorPreview =
    authorList.length === 0 ? null
    : authorList.length <= 3 ? authorList.join(', ')
    : `${authorList.slice(0, 3).join(', ')} +${authorList.length - 3}`;

  return (
    <article
      className="group relative bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm hover:shadow-md hover:ring-slate-300 transition-all duration-200 overflow-hidden"
    >
      {/* Left source rail — Material visual identity */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${railMeta.rail}`} aria-hidden />

      <div className="pl-5 pr-4 py-4">
        {/* Top metadata row */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {sources.map((s) => <SourceChip key={s} source={s} />)}
            {article.evidence_grade && <GradePill grade={article.evidence_grade} />}
          </div>
          {typeof article.relevance_score === 'number' && article.relevance_score > 0 && (
            <span className="shrink-0 text-[10px] font-medium text-slate-400 tabular-nums">
              {(article.relevance_score * 100).toFixed(0)}% match
            </span>
          )}
        </div>

        {/* Title — the focal element */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-left w-full"
        >
          <h4 className="font-serif text-[17px] leading-snug text-slate-900 group-hover:text-sky-900 transition-colors">
            {article.title}
          </h4>
        </button>

        {/* Supporting line — journal · date · authors */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-500">
          {article.journal && (
            <span className="font-medium text-slate-600 truncate max-w-[60%]">
              {article.journal}
            </span>
          )}
          {article.journal && (dateLabel || authorPreview) && <span className="text-slate-300">·</span>}
          {dateLabel && <span>{dateLabel}</span>}
          {dateLabel && authorPreview && <span className="text-slate-300">·</span>}
          {authorPreview && <span className="truncate">{authorPreview}</span>}
        </div>

        {/* Always-visible TL;DR snippet (collapsed: 2-line clamp; expanded: full) */}
        {(article.tldr || article.abstract) && (
          <p
            className={`mt-3 text-[13.5px] leading-relaxed text-slate-700 ${
              expanded ? '' : 'line-clamp-2'
            }`}
          >
            {article.tldr || article.abstract}
          </p>
        )}

        {/* Expanded content — full abstract + actions */}
        {expanded && (
          <div className="mt-3 space-y-3 animate-fade-in-up">
            {article.tldr && article.abstract && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Abstract
                </p>
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {article.abstract}
                </p>
              </div>
            )}
            {authorList.length > 3 && (
              <p className="text-[12px] text-slate-500">
                <span className="font-medium text-slate-600">Authors:</span>{' '}
                {authorList.slice(0, 8).join(', ')}
                {authorList.length > 8 && ` +${authorList.length - 8} more`}
              </p>
            )}
          </div>
        )}

        {/* Action row — Material text-buttons */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {article.pmid && (
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-sky-700 hover:bg-sky-50 transition"
              >
                PubMed
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            )}
            {article.doi && (
              <a
                href={`https://doi.org/${article.doi}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 transition"
              >
                Full text
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            )}
            {article.article_url && !article.doi && !article.pmid && (
              <a
                href={article.article_url}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Open
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
          >
            {expanded ? 'Show less' : 'Show more'}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </article>
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
  const totalSources = sourceEntries.length;

  return (
    <section className="space-y-5">
      {/* Digest header — surface card with strong type hierarchy */}
      <div className="bg-white rounded-3xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-white via-sky-50/30 to-emerald-50/30 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 mb-1">
                {title}
              </p>
              <h3 className="font-serif text-2xl text-slate-900 leading-tight">
                {digest.specialty_used || 'Medical Literature'}
              </h3>
              {dateRange && (
                <p className="text-[12px] text-slate-500 mt-1">{dateRange}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-baseline gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">
                  {digest.article_count}
                </span>
                <span className="text-[11px] text-slate-500">articles</span>
              </div>
              {totalSources > 0 && (
                <div className="flex items-baseline gap-1.5 px-3.5 py-1.5 rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                  <span className="text-2xl font-semibold tabular-nums text-slate-900">
                    {totalSources}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    source{totalSources !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {digest.topics_used && digest.topics_used.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {digest.topics_used.map((topic, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 bg-white ring-1 ring-inset ring-slate-200 text-slate-700 rounded-full text-[11px]"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {sourceEntries.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">
                Sources
              </span>
              {sourceEntries.map(([s, count]) => {
                const m = metaFor(s);
                return (
                  <span
                    key={s}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ring-1 ring-inset text-[10px] font-medium ${m.chipBg} ${m.chipText} ${m.chipRing}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${m.rail}`} />
                    {m.label}
                    <span className="opacity-60 tabular-nums">·{count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Article grid — one column on small, two on large */}
      {digest.articles && digest.articles.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {digest.articles.map((article) => (
            <ArticleCard
              key={article.id || `${article.pmid || ''}:${article.doi || article.title}`}
              article={article}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-10 text-center">
          <p className="text-sm text-slate-500">No articles found for this digest period.</p>
        </div>
      )}
    </section>
  );
}
