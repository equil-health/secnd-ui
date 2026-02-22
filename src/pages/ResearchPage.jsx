import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { submitResearch, getReport } from '../utils/api';
import useWebSocket from '../hooks/useWebSocket';
import FormattedMarkdown from '../utils/formatReport';
import ReferenceList from '../components/ReferenceList';
import ExportButtons from '../components/ExportButtons';

const STEPS = [
  { label: 'Topic accepted' },
  { label: 'Research questions' },
  { label: 'STORM research' },
  { label: 'Compiling report' },
];

function backendStepToIndex(step) {
  return Math.max(0, Math.min(step - 1, STEPS.length - 1));
}

function ProgressBar({ currentStep, completedSteps, stepLabels }) {
  return (
    <div className="flex items-center gap-1 w-full max-w-lg mx-auto my-8">
      {STEPS.map((step, i) => {
        const done = completedSteps.has(i);
        const active = i === currentStep && !done;
        return (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
              ${done ? 'bg-teal-600 border-teal-600 text-white' : active ? 'border-teal-400 text-teal-600 bg-teal-50' : 'border-gray-300 text-gray-400'}
              ${active ? 'ring-2 ring-teal-300' : ''}
            `}>
              {done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`mt-1 text-xs text-center ${done ? 'text-teal-700 font-medium' : active ? 'text-teal-600 font-medium' : 'text-gray-400'}`}>
              {stepLabels[i] || step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ResearchPage() {
  const [topic, setTopic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [researchId, setResearchId] = useState(null);
  const [phase, setPhase] = useState('input');
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepLabels, setStepLabels] = useState({});
  const [progressMsg, setProgressMsg] = useState('');
  const [report, setReport] = useState(null);

  const handleWsMessage = useCallback((data) => {
    if (data.type === 'step_update') {
      const idx = backendStepToIndex(data.step);
      if (data.status === 'running') {
        setCurrentStep(idx);
        setPhase('running');
        if (data.label) {
          setStepLabels(prev => ({ ...prev, [idx]: data.label }));
          setProgressMsg(data.label);
        }
        if (data.progress) setProgressMsg(data.progress);
      } else if (data.status === 'done') {
        setCompletedSteps(prev => new Set([...prev, idx]));
        if (data.preview) setProgressMsg(data.preview);
      }
    } else if (data.type === 'complete') {
      setCompletedSteps(new Set(STEPS.map((_, i) => i)));
      setCurrentStep(STEPS.length - 1);
      setProgressMsg('Report ready');

      const caseId = data.case_id || researchId;
      if (caseId) {
        getReport(caseId).then(r => {
          setReport(r);
          setPhase('complete');
        }).catch(() => {
          setReport({ executive_summary: data.executive_summary || '', storm_article: '', references: [], total_sources: 0 });
          setPhase('complete');
        });
      } else {
        setPhase('complete');
      }
    } else if (data.type === 'error') {
      setError(data.error || data.message || 'Research failed');
      setPhase('error');
    }
  }, [researchId]);

  useWebSocket(researchId, handleWsMessage, 'cases');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setSubmitting(true);
    setError(null);
    setReport(null);
    setPhase('running');
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setStepLabels({});
    setProgressMsg('Submitting...');

    try {
      const result = await submitResearch({ research_topic: topic.trim() });
      setResearchId(result.id);
      setCompletedSteps(new Set([0]));
      setProgressMsg('Topic accepted');
    } catch (err) {
      setError(err.message);
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setResearchId(null);
    setPhase('input');
    setCurrentStep(-1);
    setCompletedSteps(new Set());
    setStepLabels({});
    setProgressMsg('');
    setReport(null);
    setError(null);
    setTopic('');
  }

  const caseId = report?.case_id || researchId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-teal-700 hover:text-teal-600 transition">
            SECND <span className="text-sm font-normal text-gray-400 ml-1">Research Base</span>
          </Link>
          {phase === 'complete' && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Research
            </button>
          )}
        </div>
      </header>

      {/* ── Input form ── */}
      {phase === 'input' && (
        <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-gray-900">Deep Research</h1>
          <p className="mt-2 text-gray-500">
            Enter any medical topic to generate a comprehensive research article with citations.
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder="e.g. Differential diagnosis of normocytic anemia in elderly patients with elevated ESR"
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition resize-none"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !topic.trim()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                'Start Research'
              )}
            </button>
          </form>
        </main>
      )}

      {/* ── Progress ── */}
      {phase === 'running' && (
        <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in-up">
          <h2 className="text-xl font-bold text-gray-900 text-center">Researching</h2>
          <p className="text-center text-sm text-gray-500 mt-1 truncate max-w-md mx-auto">{topic}</p>
          <ProgressBar currentStep={currentStep} completedSteps={completedSteps} stepLabels={stepLabels} />
          {progressMsg && (
            <p className="text-center text-sm text-teal-600 animate-pulse">{progressMsg}</p>
          )}
        </main>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <main className="mx-auto max-w-3xl px-6 py-12">
          <div className="animate-fade-in-up rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <p className="text-red-700 font-medium">Research failed</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button onClick={handleReset} className="mt-4 text-sm text-red-600 underline hover:text-red-800">
              Try again
            </button>
          </div>
        </main>
      )}

      {/* ── Completed report ── */}
      {phase === 'complete' && report && (
        <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in-up">

          {/* Title bar */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-1">Research Report</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              {report.research_topic || topic}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
              {report.total_sources > 0 && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  {report.total_sources} sources
                </span>
              )}
              {report.created_at && (
                <span>{new Date(report.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              )}
            </div>
          </div>

          <div className="flex gap-6 items-start">

            {/* ── Main content column ── */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* Executive summary */}
              {report.executive_summary && (
                <section className="bg-teal-50 border border-teal-200 rounded-2xl p-6">
                  <h2 className="text-sm font-semibold text-teal-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    Executive Summary
                  </h2>
                  <div className="text-gray-800 leading-relaxed">
                    <FormattedMarkdown content={report.executive_summary} className="prose-teal" />
                  </div>
                </section>
              )}

              {/* STORM article body */}
              {report.storm_article && (
                <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Literature Review</h2>
                  </div>
                  <div className="px-8 py-6">
                    <FormattedMarkdown
                      content={report.storm_article}
                      className="prose-lg prose-gray prose-headings:text-gray-900 prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-li:text-gray-700 prose-li:leading-relaxed prose-strong:text-gray-900 prose-a:text-teal-600 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-teal-300 prose-blockquote:bg-gray-50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-table:text-sm"
                    />
                  </div>
                </section>
              )}

              {/* Fallback: report HTML if no storm_article */}
              {!report.storm_article && report.report_html && (
                <section className="bg-white border border-gray-200 rounded-2xl shadow-sm px-8 py-6">
                  <div
                    className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: report.report_html }}
                  />
                </section>
              )}

              {/* Inline references at bottom of article */}
              {report.references?.length > 0 && (
                <section className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                  <div className="px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">
                      References
                      <span className="ml-2 text-sm font-normal text-gray-400">({report.references.length})</span>
                    </h2>
                  </div>
                  <div className="px-8 py-6">
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
                  </div>
                </section>
              )}
            </div>

            {/* ── Sidebar ── */}
            <aside className="hidden lg:block w-72 shrink-0 sticky top-20 space-y-4">

              {/* Stats card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Stats</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Sources</span>
                  <span className="font-semibold text-gray-900">{report.total_sources ?? 0}</span>
                </div>
                {report.created_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Generated</span>
                    <span className="font-medium text-gray-700">
                      {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick reference list (scrollable) */}
              <ReferenceList references={report.references} />

              {/* Export buttons */}
              <ExportButtons caseId={caseId} />
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}
