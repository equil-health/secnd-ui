import { useState } from 'react';
import FormattedMarkdown from '../utils/formatReport';
import EvidenceVerdictPanel from './EvidenceVerdictPanel';
import ReferenceList from './ReferenceList';
import ExportButtons from './ExportButtons';

/**
 * ResearchReportViewer — 5-section pill nav viewer for research reports.
 * Follows ZebraReportViewer pattern with sections for:
 * Overview, Literature, Evidence, References, Methodology.
 */

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'literature', label: 'Literature' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'references', label: 'References' },
  { key: 'methodology', label: 'Methodology' },
];

export default function ResearchReportViewer({ report, caseId, specialty, researchIntent, useV2 }) {
  const [activeSection, setActiveSection] = useState('overview');

  if (!report) return null;

  return (
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Section nav pills */}
        <div className="flex gap-1 mb-5 flex-wrap">
          {SECTIONS.map((s) => {
            // Only show Evidence section in v2 mode
            if (s.key === 'evidence' && !useV2) return null;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  activeSection === s.key
                    ? 'bg-teal-100 text-teal-800 shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Section content */}
        <div className="space-y-5">
          {activeSection === 'overview' && (
            <OverviewSection report={report} specialty={specialty} />
          )}
          {activeSection === 'literature' && (
            <LiteratureSection report={report} />
          )}
          {activeSection === 'evidence' && (
            <EvidenceSection report={report} />
          )}
          {activeSection === 'references' && (
            <ReferencesSection report={report} />
          )}
          {activeSection === 'methodology' && (
            <MethodologySection report={report} useV2={useV2} />
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 sticky top-20 space-y-4">
        {/* Specialty badge */}
        {specialty && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <p className="text-xs text-teal-600 uppercase tracking-wide font-semibold mb-1">
              Specialty
            </p>
            <p className="text-sm font-semibold text-teal-900">
              {specialty}
            </p>
          </div>
        )}

        {/* Stats card */}
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Report Stats
          </h4>
          <Stat label="Total Sources" value={report.total_sources} />
          {report.evidence_claims?.length > 0 && (
            <Stat label="Claims Verified" value={report.evidence_claims.length} />
          )}
          {report.hallucination_issues > 0 && (
            <Stat
              label="Hallucination Issues"
              value={report.hallucination_issues}
              warn
            />
          )}
          {report.created_at && (
            <Stat
              label="Generated"
              value={new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              small
            />
          )}
        </div>

        {/* Verification Stats */}
        {report.verification_stats && (
          <VerificationWidget stats={report.verification_stats} />
        )}

        {/* References */}
        <ReferenceList references={report.references} />

        {/* Export */}
        <ExportButtons caseId={caseId} />
      </aside>
    </div>
  );
}

/* ── Section Components ───────────────────────────────────────── */

function OverviewSection({ report, specialty }) {
  return (
    <>
      {/* Executive Summary card */}
      {report.executive_summary && (
        <SectionCard title="Executive Summary" accent="teal">
          <FormattedMarkdown content={report.executive_summary} className="prose-teal" />
        </SectionCard>
      )}

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        <QuickStat
          label="Sources"
          value={report.total_sources || '—'}
          color="teal"
        />
        <QuickStat
          label="Claims Verified"
          value={report.evidence_claims?.length || '—'}
          color="indigo"
        />
        <QuickStat
          label="Specialty"
          value={specialty || 'General'}
          color="gray"
        />
      </div>
    </>
  );
}

function LiteratureSection({ report }) {
  return (
    <SectionCard title="Literature Review" accent="teal">
      {report.storm_article ? (
        <FormattedMarkdown
          content={report.storm_article}
          className="prose-lg prose-gray prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-li:text-gray-700 prose-li:leading-relaxed prose-strong:text-gray-900 prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-teal-300 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-table:text-sm"
        />
      ) : report.report_html ? (
        <div
          className="prose prose-lg prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: report.report_html }}
        />
      ) : (
        <p className="text-sm text-gray-400">No literature review available.</p>
      )}
    </SectionCard>
  );
}

function EvidenceSection({ report }) {
  return (
    <SectionCard
      title="Evidence Verification"
      subtitle="Each claim was extracted and verified against current medical literature"
      accent="indigo"
    >
      <EvidenceVerdictPanel
        claims={report.evidence_claims}
        synthesis={report.evidence_synthesis}
      />
    </SectionCard>
  );
}

function ReferencesSection({ report }) {
  if (!report.references?.length) {
    return (
      <SectionCard title="References" accent="gray">
        <p className="text-sm text-gray-400">No references available.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={`References (${report.references.length})`} accent="gray">
      <ol className="space-y-3">
        {report.references.map((ref) => (
          <li key={ref.id} id={`ref-${ref.id}`} className="flex items-start gap-3 group">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold mt-0.5">
              {ref.id}
            </span>
            <div className="min-w-0">
              {ref.url ? (
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-900 group-hover:text-teal-700 transition"
                >
                  {ref.title || ref.url}
                  <svg className="inline ml-1 w-3 h-3 text-gray-400 group-hover:text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              ) : (
                <span className="text-sm font-medium text-gray-900">{ref.title}</span>
              )}
              {ref.snippet && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{ref.snippet}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function MethodologySection({ report, useV2 }) {
  if (useV2) {
    return (
      <SectionCard title="Methodology" accent="gray">
        <div className="space-y-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">10-Step Evidence-Backed Research Pipeline</p>
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Topic Accepted</strong> — Research topic received and queued.</li>
            <li><strong>Research Questions</strong> — Gemini 2.0 Flash generated focused research questions.</li>
            <li><strong>Co-STORM Deep Research</strong> — Multi-perspective literature review with citations.</li>
            <li><strong>Hallucination Guard</strong> — Validated article for fabricated citations and errors.</li>
            <li><strong>Claim Extraction</strong> — Extracted verifiable claims from the literature review.</li>
            <li><strong>Evidence Search</strong> — Searched each claim against current scientific literature.</li>
            <li><strong>Citation Verification</strong> — Verified references via OpenAlex for authenticity.</li>
            <li><strong>Evidence Synthesis</strong> — Synthesized evidence and assigned verdicts per claim.</li>
            <li><strong>Executive Summary</strong> — Generated specialty-aware executive summary.</li>
            <li><strong>Report Compilation</strong> — Assembled unified report with enriched bibliography.</li>
          </ol>
          <p className="text-xs text-gray-500 mt-4">
            Powered by Co-STORM / STORM + Gemini 2.0 Flash + Serper.dev + OpenAlex
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Methodology" accent="gray">
      <div className="space-y-3 text-sm text-gray-700">
        <p className="font-medium text-gray-900">4-Step Research Pipeline</p>
        <ol className="list-decimal list-inside space-y-2">
          <li><strong>Topic Accepted</strong> — Research topic received and queued.</li>
          <li><strong>Topic Analysis</strong> — Gemini 2.0 Flash analyzed the topic and generated research questions.</li>
          <li><strong>Deep Research</strong> — STORM framework conducted multi-perspective literature research.</li>
          <li><strong>Report Compilation</strong> — Assembled findings with executive summary and bibliography.</li>
        </ol>
        <p className="text-xs text-gray-500 mt-4">
          Powered by STORM + Gemini 2.0 Flash
        </p>
      </div>
    </SectionCard>
  );
}

/* ── Shared UI Components ─────────────────────────────────────── */

function SectionCard({ title, subtitle, accent = 'gray', children }) {
  const accentColors = {
    teal: 'border-l-teal-400',
    indigo: 'border-l-indigo-400',
    gray: 'border-l-gray-400',
  };

  return (
    <div className={`bg-white border rounded-xl border-l-4 ${accentColors[accent] || accentColors.gray} shadow-sm`}>
      <div className="px-5 py-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">{title}</h3>
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
    teal: 'bg-teal-50 border-teal-200 text-teal-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };
  return (
    <div className={`border rounded-lg p-3 text-center ${colors[color]}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function VerificationWidget({ stats }) {
  if (!stats) return null;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Citation Verification
      </h4>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Verified</span>
        <span className="font-medium text-green-700">
          {stats.verified ?? 0}/{stats.total ?? 0}
        </span>
      </div>
      {(stats.landmark ?? 0) > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Landmark</span>
          <span className="font-medium text-amber-700">{stats.landmark}</span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Unverified</span>
        <span className="font-medium text-gray-500">{stats.unverified ?? 0}</span>
      </div>
      {(stats.retracted ?? 0) > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Retracted</span>
          <span className="font-medium text-red-600">{stats.retracted}</span>
        </div>
      )}
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
