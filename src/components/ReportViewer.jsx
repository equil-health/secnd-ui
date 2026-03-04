import { useState, useEffect, useRef } from 'react';
import FormattedMarkdown from '../utils/formatReport';
import VerdictCard from './VerdictCard';
import ReferenceList from './ReferenceList';
import ExportButtons from './ExportButtons';
import ZebraReportViewer from './ZebraReportViewer';

const TABS = [
  { key: 'analysis', label: 'Analysis' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'literature', label: 'Literature' },
];

export default function ReportViewer({ report, caseId }) {
  const [activeTab, setActiveTab] = useState('analysis');

  if (!report) return null;

  // Route to ZebraReportViewer when diagnosis_mode is "zebra"
  if (report.diagnosis_mode === 'zebra') {
    return <ZebraReportViewer report={report} caseId={caseId} />;
  }

  // Parse TOC from analysis markdown
  const tocItems = [];
  const content = activeTab === 'analysis' ? (report.medgemma_analysis || '') :
    activeTab === 'literature' ? (report.storm_article || '') : '';
  if (content) {
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/\*+/g, '').trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      tocItems.push({ level, text, id });
    }
  }

  return (
    <div className="flex gap-4 h-full">
      {/* TOC sidebar */}
      {tocItems.length > 3 && (
        <nav className="hidden xl:block w-48 shrink-0 sticky top-20 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Contents</p>
          <ul className="space-y-1">
            {tocItems.map((item, i) => (
              <li key={i} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
                <a
                  href={`#${item.id}`}
                  className="text-xs text-gray-500 hover:text-indigo-600 transition-colors block truncate"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Tabs */}
        <div className="flex border-b mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto">
          {activeTab === 'analysis' && (
            <div className="space-y-4">
              {report.executive_summary && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-indigo-700 mb-2">
                    Executive Summary
                  </h3>
                  <FormattedMarkdown content={report.executive_summary} />
                </div>
              )}
              <FormattedMarkdown content={report.medgemma_analysis} />
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-3">
              {report.evidence_claims?.length > 0 ? (
                report.evidence_claims.map((claim, i) => (
                  <VerdictCard key={i} claim={claim} />
                ))
              ) : (
                <p className="text-sm text-gray-400">No evidence claims available.</p>
              )}
            </div>
          )}

          {activeTab === 'literature' && (
            <div>
              {report.storm_article ? (
                <FormattedMarkdown content={report.storm_article} />
              ) : (
                <p className="text-sm text-gray-400">No literature review available.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="w-72 shrink-0 space-y-4">
        {/* Diagnosis badge */}
        {report.primary_diagnosis && (
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Physician Diagnosis
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {report.primary_diagnosis}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <Stat label="Total Sources" value={report.total_sources} />
          <Stat
            label="Hallucination Issues"
            value={report.hallucination_issues}
            warn={report.hallucination_issues > 0}
          />
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

function Stat({ label, value, warn }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${warn ? 'text-amber-600' : 'text-gray-900'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}
