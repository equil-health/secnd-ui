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
  if (c === 'high') return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500' };
  if (c === 'moderate') return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', dot: 'bg-amber-500' };
  if (c.includes('low')) return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-500' };
  return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-400' };
}

function verificationStyle(v) {
  const s = v?.toLowerCase() || '';
  if (s.includes('kg-verified') || s.includes('✓')) return { bg: 'bg-green-50', text: 'text-green-700', icon: '✓', label: 'KG Verified' };
  if (s.includes('evidence-supported')) return { bg: 'bg-blue-50', text: 'text-blue-700', icon: '◉', label: 'Evidence Supported' };
  if (s.includes('completeness')) return { bg: 'bg-purple-50', text: 'text-purple-700', icon: '+', label: 'Completeness Added' };
  if (s.includes('must-exclude')) return { bg: 'bg-red-50', text: 'text-red-700', icon: '⚠', label: 'Must Exclude' };
  return { bg: 'bg-gray-50', text: 'text-gray-600', icon: '·', label: v };
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

const SECTION_ICONS = {
  '1': { icon: '⚖', color: 'text-indigo-600', bg: 'bg-indigo-50' },       // Executive Verdict
  '2a': { icon: '🚨', color: 'text-red-600', bg: 'bg-red-50' },           // Critical Safety
  '2b': { icon: '⛔', color: 'text-red-600', bg: 'bg-red-50' },           // Treatment Hold
  '3': { icon: '📷', color: 'text-slate-600', bg: 'bg-slate-50' },         // Imaging
  '4': { icon: '🔬', color: 'text-purple-600', bg: 'bg-purple-50' },       // Differential
  '5': { icon: '✅', color: 'text-blue-600', bg: 'bg-blue-50' },           // Completeness
  '6': { icon: '📚', color: 'text-teal-600', bg: 'bg-teal-50' },          // Evidence
  '7': { icon: '❓', color: 'text-amber-600', bg: 'bg-amber-50' },         // Knowledge Gaps
  '8': { icon: '💊', color: 'text-green-600', bg: 'bg-green-50' },         // Recommendations
  '9': { icon: '🌊', color: 'text-indigo-600', bg: 'bg-indigo-50' },       // STORM
};

function getSectionMeta(title) {
  const num = title.match(/^(\d+[ab]?)\./)?.[1];
  return SECTION_ICONS[num] || { icon: '📋', color: 'text-gray-600', bg: 'bg-gray-50' };
}

function getSectionLabel(title) {
  // Strip the number prefix for cleaner display
  return title.replace(/^\d+[ab]?\.\s*/, '');
}

// ── Sub-components ───────────────────────────────────────────────

function VerdictSection({ body, title }) {
  // Extract the verdict keyword (CAUTION, SUPPORTED, etc.)
  const verdictMatch = body.match(/\*\*(\w+)\.?\*\*/);
  const verdict = verdictMatch?.[1]?.toUpperCase() || '';

  const verdictColors = {
    CAUTION: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-500 text-white', ring: 'ring-amber-100' },
    SUPPORTED: { bg: 'bg-green-50', border: 'border-green-300', badge: 'bg-green-500 text-white', ring: 'ring-green-100' },
    CONTRADICTED: { bg: 'bg-red-50', border: 'border-red-300', badge: 'bg-red-500 text-white', ring: 'ring-red-100' },
  };
  const vc = verdictColors[verdict] || { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-500 text-white', ring: 'ring-indigo-100' };

  return (
    <div className={`rounded-xl border-2 ${vc.border} ${vc.bg} px-5 py-4 ring-4 ${vc.ring}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${vc.badge}`}>{verdict || 'VERDICT'}</span>
        <span className="text-sm font-semibold text-gray-800">{getSectionLabel(title)}</span>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed">
        <FormattedMarkdown content={body} />
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
        <div className="text-sm text-gray-600 mb-3">
          <FormattedMarkdown content={nonTableBody} />
        </div>
      )}
      <div className="space-y-2">
        {rows.map((row) => {
          const conf = confidenceStyle(row.confidence);
          const verif = verificationStyle(row.verification);

          return (
            <div
              key={row.rank}
              className={`rounded-xl border ${conf.border} ${conf.bg} px-4 py-3 flex items-center gap-3 transition hover:shadow-sm`}
            >
              {/* Rank */}
              <div className={`w-8 h-8 rounded-full ${conf.dot} text-white flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                {row.rank}
              </div>

              {/* Diagnosis + details */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${conf.text}`}>{row.diagnosis}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${conf.bg} ${conf.text} border ${conf.border}`}>
                    {row.confidence}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${verif.bg} ${verif.text}`}>
                    {verif.icon} {verif.label}
                  </span>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="w-20 flex-shrink-0 hidden sm:block">
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${conf.dot}`}
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

function TreatmentHoldSection({ body, title }) {
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 ring-4 ring-red-100 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1 text-sm">
          <FormattedMarkdown content={body} />
        </div>
      </div>
    </div>
  );
}

function SafetySection({ body, title }) {
  const hasAlerts = !body.toLowerCase().includes('no critical safety alerts');
  return (
    <div className={`rounded-xl border px-5 py-4 ${
      hasAlerts
        ? 'border-red-300 bg-red-50'
        : 'border-green-200 bg-green-50'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        {hasAlerts ? (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        )}
        <span className={`text-sm font-semibold ${hasAlerts ? 'text-red-700' : 'text-green-700'}`}>
          {hasAlerts ? 'Critical Safety Alerts' : 'No Critical Safety Alerts'}
        </span>
      </div>
      {hasAlerts && (
        <div className="text-sm text-red-700 mt-2">
          <FormattedMarkdown content={body} />
        </div>
      )}
    </div>
  );
}

function KnowledgeGapsSection({ body }) {
  const gaps = body.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^-\s*/, '').trim());

  if (gaps.length === 0) {
    return <div className="text-sm text-gray-600"><FormattedMarkdown content={body} /></div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {gaps.map((gap, i) => {
        const isCritical = gap.toLowerCase().includes('critical');
        return (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2.5 flex items-start gap-2 ${
              isCritical ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <span className={`text-sm mt-0.5 ${isCritical ? 'text-amber-500' : 'text-gray-400'}`}>
              {isCritical ? '⚠' : '?'}
            </span>
            <span className={`text-sm ${isCritical ? 'text-amber-800 font-medium' : 'text-gray-700'}`}>{gap}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecommendationsSection({ body }) {
  const items = body.split('\n').filter((l) => /^\d+\./.test(l.trim()));

  if (items.length === 0) {
    return <div className="text-sm text-gray-600"><FormattedMarkdown content={body} /></div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const text = item.replace(/^\d+\.\s*/, '').trim();
        const isUrgent = text.toLowerCase().includes('urgent') || text.toLowerCase().includes('do not');
        return (
          <div
            key={i}
            className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${
              isUrgent ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              isUrgent ? 'bg-red-500 text-white' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {i + 1}
            </span>
            <div className="text-sm flex-1">
              <FormattedMarkdown content={text} />
            </div>
            {isUrgent && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                URGENT
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
    return <div className="text-sm text-gray-600"><FormattedMarkdown content={body} /></div>;
  }

  return (
    <div className="space-y-2">
      {refs.map((ref, i) => {
        const gradeMatch = ref.match(/\[Grade\s+([A-D])\]/i);
        const grade = gradeMatch?.[1]?.toUpperCase();
        const gradeColor = grade === 'A' ? 'bg-green-100 text-green-700 border-green-300'
          : grade === 'B' ? 'bg-blue-100 text-blue-700 border-blue-300'
          : grade === 'C' ? 'bg-amber-100 text-amber-700 border-amber-300'
          : 'bg-gray-100 text-gray-600 border-gray-300';
        const refText = ref.replace(/\[Grade\s+[A-D]\]/i, '').trim();

        return (
          <div key={i} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 flex items-start gap-3">
            {grade && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5 ${gradeColor}`}>
                Grade {grade}
              </span>
            )}
            <p className="text-sm text-gray-700 flex-1">
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
    <div className="text-sm text-gray-700 leading-relaxed">
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
    <div className="space-y-4">
      {/* Report header card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <span className="text-base font-bold text-gray-800">Verified Second Opinion</span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              v{version}
            </span>
            {is_provisional && (
              <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                Provisional — Deep Research Pending
              </span>
            )}
          </div>

          {/* Quick stats row */}
          <div className="flex items-center gap-4 mt-2">
            {treatment_holds.length > 0 && (
              <span className="text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                {treatment_holds.length} Treatment Hold{treatment_holds.length > 1 ? 's' : ''}
              </span>
            )}
            {completeness_added.length > 0 && (
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                +{completeness_added.length} Completeness Add{completeness_added.length > 1 ? 's' : ''}
              </span>
            )}
            {report.verification_chain_complete && (
              <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Verification Complete
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
              <div key={idx} className="text-[11px] text-gray-400 italic text-center px-4 py-2">
                <FormattedMarkdown content={section.body} />
              </div>
            );
          }
          return null; // Skip banner — info is in header card
        }

        const meta = getSectionMeta(section.title);
        const label = getSectionLabel(section.title);
        const isCollapsed = collapsedSections[idx];
        const num = section.title.match(/^(\d+[ab]?)\./)?.[1];
        // Don't collapse verdict, treatment hold, or safety by default
        const isHighPriority = ['1', '2a', '2b', '4'].includes(num);

        return (
          <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Section header */}
            <button
              onClick={() => toggleSection(idx)}
              className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-left"
            >
              <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center text-base flex-shrink-0`}>
                {meta.icon}
              </div>
              <span className="text-sm font-semibold text-gray-800 flex-1">{label}</span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Section content */}
            {!isCollapsed && (
              <div className="px-5 pb-4">
                {renderSectionContent(section)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
