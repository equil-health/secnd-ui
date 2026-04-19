import { useState } from 'react';
import FormattedMarkdown from '../../utils/formatReport';

// ── Section parsing ──────────────────────────────────────────────

function parseSections(markdown) {
  if (!markdown) return [];
  const sections = [];
  // Split on ## headings
  const parts = markdown.split(/^---\s*$/m).filter((p) => p.trim());

  for (const part of parts) {
    const heading = part.match(/^##\s+(.+)$/m);
    if (heading) {
      const title = heading[1].trim();
      const body = part.slice(part.indexOf(heading[0]) + heading[0].length).trim();
      sections.push({ title, body, raw: part.trim() });
    } else {
      // Preamble (banner text) or disclaimer
      const trimmed = part.trim();
      if (trimmed.startsWith('_') || trimmed.startsWith('*Disclaimer')) {
        sections.push({ title: trimmed.startsWith('_') ? '__banner__' : '__disclaimer__', body: trimmed, raw: trimmed });
      }
    }
  }
  return sections;
}

// ── Confidence styling ───────────────────────────────────────────

function confidenceStyle(conf) {
  const c = conf?.toLowerCase() || '';
  if (c === 'high') return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (c === 'moderate') return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' };
  if (c.includes('low')) return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-500' };
  return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
}

function verificationStyle(v) {
  const s = v?.toLowerCase() || '';
  if (s.includes('kg-verified') || s.includes('✓')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓', label: 'KG Verified' };
  if (s.includes('evidence-supported')) return { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: '◉', label: 'Evidence Supported' };
  if (s.includes('completeness')) return { bg: 'bg-slate-100', text: 'text-slate-700', icon: '+', label: 'Completeness Added' };
  if (s.includes('must-exclude')) return { bg: 'bg-red-50', text: 'text-red-700', icon: '⚠', label: 'Must Exclude' };
  return { bg: 'bg-slate-50', text: 'text-slate-600', icon: '·', label: v };
}

// ── Parse differential table from markdown ───────────────────────

function parseDifferentialTable(body) {
  const rows = [];
  const lines = body.split('\n').filter((l) => l.trim().startsWith('|'));
  // Skip header and separator rows
  const dataLines = lines.filter((l) => !l.includes('---') && !l.toLowerCase().includes('rank'));
  for (const line of dataLines) {
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 4) {
      rows.push({
        rank: parseInt(cells[0]) || rows.length + 1,
        diagnosis: cells[1],
        confidence: cells[2],
        verification: cells[3],
      });
    }
  }
  return rows;
}

// ── Section icon mapping ─────────────────────────────────────────

// Monochrome section marks — emoji replaced with short textual labels
// rendered as all-caps eyebrows. Cleaner and more professional than the
// colorful emoji palette.
const SECTION_MARKS = {
  '1':  { mark: 'Verdict',         tone: 'indigo' },
  '2a': { mark: 'Safety',          tone: 'red'    },
  '2b': { mark: 'Treatment Hold',  tone: 'red'    },
  '3':  { mark: 'Imaging',         tone: 'slate'  },
  '3b': { mark: 'Clinical Context', tone: 'slate' },
  '4':  { mark: 'Differential',    tone: 'slate'  },
  '4b': { mark: 'Completeness',    tone: 'slate'  },
  '5':  { mark: 'Evidence',        tone: 'indigo' },
  '6':  { mark: 'Evidence',        tone: 'indigo' },
  '7':  { mark: 'Knowledge Gaps',  tone: 'amber'  },
  '8':  { mark: 'Recommendations', tone: 'emerald' },
  '9':  { mark: 'Deep Research',   tone: 'indigo' },
};

const TONE_STYLES = {
  slate:   { dot: 'bg-slate-500',   text: 'text-slate-600' },
  indigo:  { dot: 'bg-indigo-500',  text: 'text-indigo-600' },
  emerald: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
  amber:   { dot: 'bg-amber-500',   text: 'text-amber-600' },
  red:     { dot: 'bg-red-500',     text: 'text-red-600' },
};

function getSectionMeta(title) {
  const num = title.match(/^(\d+[ab]?)\./)?.[1];
  const entry = SECTION_MARKS[num] || { mark: 'Section', tone: 'slate' };
  return { ...entry, ...TONE_STYLES[entry.tone] };
}

function getSectionLabel(title) {
  // Strip the number prefix for cleaner display
  return title.replace(/^\d+[ab]?\.\s*/, '');
}

// ── Sub-components ───────────────────────────────────────────────

function VerdictSection({ body, title }) {
  const verdictMatch = body.match(/\*\*(\w+)\.?\*\*/);
  const verdict = verdictMatch?.[1]?.toUpperCase() || '';

  const verdictColors = {
    CAUTION:      { accent: 'from-amber-500 to-amber-600',   badge: 'bg-amber-500 text-white' },
    SUPPORTED:    { accent: 'from-emerald-500 to-emerald-600', badge: 'bg-emerald-500 text-white' },
    CONTRADICTED: { accent: 'from-red-500 to-red-600',       badge: 'bg-red-500 text-white' },
  };
  const vc = verdictColors[verdict] || { accent: 'from-indigo-500 to-indigo-600', badge: 'bg-indigo-500 text-white' };

  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${vc.accent}`} />
      <div className="px-5 py-4 pl-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.18em] uppercase ${vc.badge}`}>
            {verdict || 'Verdict'}
          </span>
          <span className="eyebrow text-slate-500">
            {getSectionLabel(title)}
          </span>
        </div>
        <div className="text-[15px] text-slate-800 leading-relaxed">
          <FormattedMarkdown content={body} />
        </div>
      </div>
    </div>
  );
}

function DifferentialSection({ body, title }) {
  const rows = parseDifferentialTable(body);
  const nonTableBody = body.split(/\|.*\|/m)[0]?.trim();

  if (rows.length === 0) {
    return <GenericSection body={body} title={title} />;
  }

  return (
    <div>
      {nonTableBody && (
        <div className="text-sm text-slate-600 mb-3 leading-relaxed">
          <FormattedMarkdown content={nonTableBody} />
        </div>
      )}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
        {rows.map((row) => {
          const conf = confidenceStyle(row.confidence);
          const verif = verificationStyle(row.verification);

          return (
            <div key={row.rank} className="px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition">
              {/* Rank */}
              <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {row.rank}
              </div>

              {/* Diagnosis + details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{row.diagnosis}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${conf.bg} ${conf.text} border ${conf.border}`}>
                    {row.confidence}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${verif.bg} ${verif.text}`}>
                    {verif.icon} {verif.label}
                  </span>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="w-24 flex-shrink-0 hidden sm:block">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${conf.dot} transition-all duration-500`}
                    style={{ width: row.confidence === 'High' ? '90%' : row.confidence === 'Moderate' ? '60%' : '30%' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TreatmentHoldSection({ body }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-red-200 shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
      <div className="px-5 py-4 pl-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 text-sm text-slate-700 leading-relaxed">
            <FormattedMarkdown content={body} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SafetySection({ body }) {
  const hasAlerts = !body.toLowerCase().includes('no critical safety alerts');
  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${hasAlerts ? 'bg-red-500' : 'bg-emerald-500'}`} />
      <div className="px-5 py-4 pl-6">
        <div className="flex items-center gap-2 mb-1">
          {hasAlerts ? (
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75" />
            </svg>
          )}
          <span className={`text-sm font-semibold ${hasAlerts ? 'text-red-700' : 'text-emerald-700'}`}>
            {hasAlerts ? 'Critical Safety Alerts' : 'No critical safety alerts'}
          </span>
        </div>
        {hasAlerts && (
          <div className="text-sm text-slate-700 mt-2 leading-relaxed">
            <FormattedMarkdown content={body} />
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeGapsSection({ body }) {
  const gaps = body.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^-\s*/, '').trim());

  if (gaps.length === 0) {
    return <div className="text-sm text-slate-600 leading-relaxed"><FormattedMarkdown content={body} /></div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {gaps.map((gap, i) => {
        const isCritical = gap.toLowerCase().includes('critical');
        return (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2.5 flex items-start gap-2 ${
              isCritical ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className={`text-sm mt-0.5 font-bold ${isCritical ? 'text-amber-600' : 'text-slate-400'}`}>
              {isCritical ? '⚠' : '?'}
            </span>
            <span className={`text-sm ${isCritical ? 'text-amber-900 font-medium' : 'text-slate-700'}`}>{gap}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsSection({ body }) {
  const items = body.split('\n').filter((l) => /^\d+\./.test(l.trim()));

  if (items.length === 0) {
    return <div className="text-sm text-slate-600 leading-relaxed"><FormattedMarkdown content={body} /></div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const text = item.replace(/^\d+\.\s*/, '').trim();
        const isUrgent = text.toLowerCase().includes('urgent') || text.toLowerCase().includes('do not');
        return (
          <div
            key={i}
            className={`relative overflow-hidden rounded-lg border px-4 py-3 flex items-start gap-3 ${
              isUrgent ? 'border-red-200 bg-white' : 'border-slate-200 bg-white'
            }`}
          >
            {isUrgent && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500" />}
            <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              isUrgent ? 'bg-red-500 text-white' : 'bg-slate-900 text-white'
            }`}>
              {i + 1}
            </span>
            <div className="text-sm text-slate-700 flex-1 leading-relaxed">
              <FormattedMarkdown content={text} />
            </div>
            {isUrgent && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider flex-shrink-0">
                Urgent
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvidenceSection({ body }) {
  const refs = body.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^-\s*/, '').trim());

  if (refs.length === 0) {
    return <div className="text-sm text-slate-600 leading-relaxed"><FormattedMarkdown content={body} /></div>;
  }

  return (
    <div className="space-y-2">
      {refs.map((ref, i) => {
        const gradeMatch = ref.match(/\[Grade\s+([A-D])\]/i);
        const grade = gradeMatch?.[1]?.toUpperCase();
        const gradeColor =
          grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : grade === 'B' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : grade === 'C' ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';
        const refText = ref.replace(/\[Grade\s+[A-D]\]/i, '').trim();

        return (
          <div key={i} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 flex items-start gap-3 hover:border-slate-300 transition">
            {grade && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 uppercase tracking-wider ${gradeColor}`}>
                {grade}
              </span>
            )}
            <p className="text-sm text-slate-700 flex-1 leading-relaxed">
              <FormattedMarkdown content={refText} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

function GenericSection({ body }) {
  return (
    <div className="text-sm text-slate-700 leading-relaxed">
      <FormattedMarkdown content={body} />
    </div>
  );
}

// ── Section router ───────────────────────────────────────────────

function renderSectionContent(section) {
  const num = section.title.match(/^(\d+[ab]?)\./)?.[1];

  switch (num) {
    case '1': return <VerdictSection body={section.body} title={section.title} />;
    case '2a': return <SafetySection body={section.body} title={section.title} />;
    case '2b': return <TreatmentHoldSection body={section.body} title={section.title} />;
    case '4': return <DifferentialSection body={section.body} title={section.title} />;
    case '6': return <EvidenceSection body={section.body} />;
    case '7': return <KnowledgeGapsSection body={section.body} />;
    case '8': return <RecommendationsSection body={section.body} />;
    default: return <GenericSection body={section.body} />;
  }
}

// ── Main component ───────────────────────────────────────────────

export default function ReportRenderer({ report }) {
  if (!report) return null;

  const { markdown, version, is_provisional, treatment_holds = [], completeness_added = [] } = report;
  const sections = parseSections(markdown);
  const [collapsedSections, setCollapsedSections] = useState({});

  function toggleSection(idx) {
    setCollapsedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div className="space-y-3">
      {/* Report header — dark, confident */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-900/20">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(ellipse at top right, rgba(99,102,241,0.35), transparent 55%), radial-gradient(ellipse at bottom left, rgba(16,185,129,0.2), transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative px-5 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25 4.5-4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="eyebrow text-indigo-300">
                  Verified · SECND v{version}
                </div>
                <div className="display-title text-lg text-white mt-0.5">Second Opinion Report</div>
              </div>
            </div>
            {is_provisional && (
              <span className="text-[10px] font-semibold px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 uppercase tracking-wider">
                Provisional · Deep Research Pending
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
            {report.verification_chain_complete && (
              <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Verification chain complete
              </span>
            )}
            {treatment_holds.length > 0 && (
              <span className="text-[10px] font-semibold text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                {treatment_holds.length} treatment hold{treatment_holds.length > 1 ? 's' : ''}
              </span>
            )}
            {completeness_added.length > 0 && (
              <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                +{completeness_added.length} completeness add{completeness_added.length > 1 ? '' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, idx) => {
        if (section.title === '__banner__' || section.title === '__disclaimer__') {
          if (section.title === '__disclaimer__') {
            return (
              <div key={idx} className="text-[10px] text-slate-400 italic text-center px-4 py-3 border-t border-slate-100 mt-2">
                <FormattedMarkdown content={section.body} />
              </div>
            );
          }
          return null;
        }

        const meta = getSectionMeta(section.title);
        const label = getSectionLabel(section.title);
        const isCollapsed = collapsedSections[idx];

        return (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition">
            <button
              onClick={() => toggleSection(idx)}
              className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition text-left"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} flex-shrink-0`} />
                <span className={`eyebrow ${meta.text} flex-shrink-0`}>
                  {meta.mark}
                </span>
                <span className="display-title text-base text-slate-900 truncate">{label}</span>
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {!isCollapsed && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                {renderSectionContent(section)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
