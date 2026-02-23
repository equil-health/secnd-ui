import { useState } from 'react';
import FormattedMarkdown from '../utils/formatReport';
import VerdictCard from './VerdictCard';
import ReferenceList from './ReferenceList';
import ExportButtons from './ExportButtons';

/**
 * ZebraReportViewer — a dedicated report viewer for Think Zebra (rare disease)
 * reports. Breaks the dense analysis into readable, chunked sections with
 * clear visual hierarchy and card-based layout.
 */

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'horses', label: 'Excluded (Horses)' },
  { key: 'zebras', label: 'Zebra Hypotheses' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'literature', label: 'Literature' },
  { key: 'pathway', label: 'Next Steps' },
];

export default function ZebraReportViewer({ report, caseId }) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!report) return null;

  // Parse structured data from report_html/medgemma_analysis
  const analysis = report.medgemma_analysis || '';
  const parsed = parseZebraAnalysis(analysis);

  return (
    <div className="flex gap-6 h-full">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Section nav pills */}
        <div className="flex gap-1 mb-5 flex-wrap">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                activeSection === s.key
                  ? 'bg-amber-100 text-amber-800 shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="space-y-5">
          {activeSection === 'overview' && (
            <OverviewSection report={report} parsed={parsed} />
          )}
          {activeSection === 'horses' && (
            <HorsesSection parsed={parsed} analysis={analysis} />
          )}
          {activeSection === 'zebras' && (
            <ZebrasSection parsed={parsed} analysis={analysis} />
          )}
          {activeSection === 'evidence' && (
            <EvidenceSection report={report} />
          )}
          {activeSection === 'literature' && (
            <LiteratureSection report={report} />
          )}
          {activeSection === 'pathway' && (
            <PathwaySection parsed={parsed} analysis={analysis} />
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="w-72 shrink-0 space-y-4">
        {/* Mode badge */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🦓</span>
            <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">
              Think Zebra
            </p>
          </div>
          <p className="text-sm font-semibold text-amber-900">
            Rare Disease Analysis
          </p>
        </div>

        {/* Primary diagnosis */}
        {report.primary_diagnosis && (
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Top Zebra Hypothesis
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {report.primary_diagnosis}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <Stat label="Total Sources" value={report.total_sources} />
          <Stat label="Rare Disease DBs" value="Orphanet, OMIM, GARD" small />
          <Stat
            label="Hallucination Issues"
            value={report.hallucination_issues}
            warn={report.hallucination_issues > 0}
          />
        </div>

        {/* References */}
        <ReferenceList references={report.references} />

        {/* Export */}
        <ExportButtons caseId={caseId} />
      </aside>
    </div>
  );
}

/* ── Section Components ───────────────────────────────────────── */

function OverviewSection({ report, parsed }) {
  return (
    <>
      {/* Executive Summary card */}
      {report.executive_summary && (
        <SectionCard
          title="Executive Summary"
          accent="amber"
          icon="📋"
        >
          <FormattedMarkdown content={report.executive_summary} />
        </SectionCard>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        <QuickStat
          label="Common Excluded"
          value={parsed.horsesCount || '—'}
          color="gray"
        />
        <QuickStat
          label="Zebra Hypotheses"
          value={parsed.zebrasCount || '—'}
          color="amber"
        />
        <QuickStat
          label="Sources Searched"
          value={report.total_sources || '—'}
          color="indigo"
        />
      </div>
    </>
  );
}

function HorsesSection({ parsed, analysis }) {
  // Try to extract the "excluded" section from the analysis
  const horsesContent = parsed.horsesSection;

  return (
    <SectionCard
      title="Common Diagnoses Excluded"
      subtitle="These &quot;horses&quot; were considered but excluded based on the clinical evidence"
      accent="gray"
      icon="🐴"
    >
      {horsesContent ? (
        <FormattedMarkdown content={horsesContent} />
      ) : (
        <p className="text-sm text-gray-400">
          Excluded diagnoses will appear here once the analysis completes.
        </p>
      )}
    </SectionCard>
  );
}

function ZebrasSection({ parsed, analysis }) {
  const hypotheses = parsed.zebraHypotheses;

  if (hypotheses.length === 0) {
    return (
      <SectionCard title="Zebra Hypotheses" accent="amber" icon="🦓">
        {parsed.zebrasSection ? (
          <FormattedMarkdown content={parsed.zebrasSection} />
        ) : (
          <p className="text-sm text-gray-400">
            Rare disease hypotheses will appear here once the analysis completes.
          </p>
        )}
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {hypotheses.map((hyp, i) => (
        <div
          key={i}
          className="border-2 border-amber-200 rounded-xl bg-amber-50/50 overflow-hidden"
        >
          {/* Hypothesis header */}
          <div className="bg-amber-100/70 px-5 py-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-600 bg-amber-200 px-2 py-0.5 rounded-full">
                #{i + 1}
              </span>
              <h4 className="text-sm font-bold text-amber-900">{hyp.name}</h4>
            </div>
          </div>
          {/* Hypothesis body */}
          <div className="px-5 py-4">
            <FormattedMarkdown content={hyp.content} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceSection({ report }) {
  return (
    <SectionCard
      title="Evidence Verification"
      subtitle="Each claim was searched against rare disease databases and medical literature"
      accent="indigo"
      icon="🔍"
    >
      <div className="space-y-3 mt-2">
        {report.evidence_claims?.length > 0 ? (
          report.evidence_claims.map((claim, i) => (
            <VerdictCard key={i} claim={claim} />
          ))
        ) : (
          <p className="text-sm text-gray-400">No evidence claims available.</p>
        )}
      </div>
    </SectionCard>
  );
}

function LiteratureSection({ report }) {
  return (
    <SectionCard
      title="STORM Literature Review"
      subtitle="Deep research on the rare disease differential"
      accent="teal"
      icon="📚"
    >
      {report.storm_article ? (
        <FormattedMarkdown content={report.storm_article} />
      ) : (
        <p className="text-sm text-gray-400">No literature review available.</p>
      )}
    </SectionCard>
  );
}

function PathwaySection({ parsed, analysis }) {
  const pathwayContent = parsed.pathwaySection;

  return (
    <SectionCard
      title="Recommended Diagnostic Pathway"
      subtitle="Step-by-step workup to confirm or exclude the zebra hypotheses"
      accent="green"
      icon="🧬"
    >
      {pathwayContent ? (
        <FormattedMarkdown content={pathwayContent} />
      ) : (
        <p className="text-sm text-gray-400">
          Diagnostic pathway recommendations will appear here once the analysis completes.
        </p>
      )}
    </SectionCard>
  );
}

/* ── Shared UI Components ─────────────────────────────────────── */

function SectionCard({ title, subtitle, accent = 'gray', icon, children }) {
  const accentColors = {
    amber: 'border-l-amber-400',
    indigo: 'border-l-indigo-400',
    teal: 'border-l-teal-400',
    green: 'border-l-green-400',
    gray: 'border-l-gray-400',
  };

  return (
    <div className={`bg-white border rounded-xl border-l-4 ${accentColors[accent]} shadow-sm`}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className="text-base">{icon}</span>}
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 mb-3">{subtitle}</p>
        )}
        <div className="prose prose-sm max-w-none">{children}</div>
      </div>
    </div>
  );
}

function QuickStat({ label, value, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${colors[color]}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Stat({ label, value, warn, small }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span
        className={`font-medium ${
          warn ? 'text-amber-600' : small ? 'text-xs text-gray-600' : 'text-gray-900'
        }`}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

/* ── Analysis Parser ──────────────────────────────────────────── */

/**
 * Parse the MedGemma zebra analysis text into structured sections.
 * Looks for numbered headers like "1. CASE SUMMARY", "2. COMMON DIAGNOSES...",
 * "3. ZEBRA HYPOTHESES", etc.
 */
function parseZebraAnalysis(text) {
  if (!text) {
    return {
      horsesCount: 0,
      zebrasCount: 0,
      horsesSection: '',
      zebrasSection: '',
      pathwaySection: '',
      zebraHypotheses: [],
    };
  }

  // Split by numbered section headers (e.g., "2. COMMON DIAGNOSES" or "## 2.")
  const sectionRegex = /(?:^|\n)(?:#{1,3}\s*)?(\d+)\.\s+([A-Z][A-Z\s:()]+)/g;
  const sections = {};
  let lastIdx = 0;
  let lastKey = null;
  const matches = [...text.matchAll(sectionRegex)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (lastKey !== null) {
      sections[lastKey] = text.slice(lastIdx, m.index).trim();
    }
    const headerLower = m[2].toLowerCase().trim();
    if (headerLower.includes('common') || headerLower.includes('excluded') || headerLower.includes('horse')) {
      lastKey = 'horses';
    } else if (headerLower.includes('zebra') || headerLower.includes('rare')) {
      lastKey = 'zebras';
    } else if (headerLower.includes('pathway') || headerLower.includes('next step') || headerLower.includes('diagnostic')) {
      lastKey = 'pathway';
    } else if (headerLower.includes('pattern')) {
      lastKey = 'pattern';
    } else if (headerLower.includes('patient')) {
      lastKey = 'patient';
    } else {
      lastKey = 'section_' + m[1];
    }
    lastIdx = m.index + m[0].length;
  }
  // Capture the last section
  if (lastKey !== null) {
    sections[lastKey] = text.slice(lastIdx).trim();
  }

  // Count horses (look for bullet points or numbered items)
  const horsesText = sections.horses || '';
  const horsesCount = (horsesText.match(/^[-*]\s|^\d+\./gm) || []).length || (horsesText ? 'See below' : 0);

  // Parse individual zebra hypotheses
  const zebrasText = sections.zebras || '';
  const zebraHypotheses = parseHypotheses(zebrasText);
  const zebrasCount = zebraHypotheses.length || (zebrasText ? 'See below' : 0);

  return {
    horsesCount,
    zebrasCount,
    horsesSection: horsesText,
    zebrasSection: zebrasText,
    pathwaySection: sections.pathway || '',
    zebraHypotheses,
  };
}

/**
 * Parse zebra hypotheses from the zebras section text.
 * Looks for patterns like "ZEBRA HYPOTHESIS 1:", "Hypothesis 1:",
 * or "**Name**" headers.
 */
function parseHypotheses(text) {
  if (!text) return [];

  // Try splitting by "Zebra Hypothesis N:" or "Hypothesis N:" patterns
  const hypRegex = /(?:^|\n)(?:#{1,3}\s*)?(?:Zebra\s+)?Hypothesis\s+(\d+)\s*[:\-—]\s*(.*?)(?=\n(?:#{1,3}\s*)?(?:Zebra\s+)?Hypothesis\s+\d|$)/gis;
  const hypotheses = [];
  let match;

  while ((match = hypRegex.exec(text)) !== null) {
    const name = match[2].split('\n')[0].replace(/\*+/g, '').trim() || `Hypothesis ${match[1]}`;
    hypotheses.push({
      name,
      content: match[2].trim(),
    });
  }

  if (hypotheses.length > 0) return hypotheses;

  // Fallback: split by bold headers like "**Condition Name**"
  const boldRegex = /\*\*([^*]+)\*\*\s*(?:[:\-—])/g;
  const parts = text.split(boldRegex);
  if (parts.length > 2) {
    for (let i = 1; i < parts.length; i += 2) {
      hypotheses.push({
        name: parts[i].trim(),
        content: (parts[i + 1] || '').trim(),
      });
    }
    return hypotheses;
  }

  // Final fallback: return the whole text as one section
  if (text.trim()) {
    return [{ name: 'Rare Disease Candidates', content: text.trim() }];
  }

  return [];
}
