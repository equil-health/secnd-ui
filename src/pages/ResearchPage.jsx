import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { submitResearch, confirmResearch, getReport } from '../utils/api';
import useWebSocket from '../hooks/useWebSocket';
import ResearchReportViewer from '../components/ResearchReportViewer';
import UserBadge from '../components/UserBadge';
import useAuthStore from '../stores/authStore';
import useToastStore from '../stores/toastStore';
import { getMe } from '../utils/api';

const STEPS_V1 = [
  { label: 'Topic accepted' },
  { label: 'Research questions' },
  { label: 'STORM research' },
  { label: 'Compiling report' },
];

const STEPS_V2 = [
  { label: 'Topic accepted' },
  { label: 'Research questions' },
  { label: 'Co-STORM research' },
  { label: 'Hallucination check' },
  { label: 'Extracting claims' },
  { label: 'Searching evidence' },
  { label: 'Verifying citations' },
  { label: 'Synthesizing evidence' },
  { label: 'Executive summary' },
  { label: 'Compiling report' },
];

const SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Neurology',
  'Oncology',
  'Pulmonology',
  'Gastroenterology',
  'Nephrology',
  'Endocrinology',
  'Rheumatology',
  'Infectious Disease',
  'Hematology',
  'Dermatology',
  'Psychiatry',
  'Pediatrics',
  'Surgery',
];

const INTENTS = [
  { key: 'clinical_management', label: 'Clinical Management' },
  { key: 'literature_review', label: 'Literature Review' },
  { key: 'cme', label: 'CME' },
  { key: 'case_report', label: 'Case Report' },
];

function backendStepToIndex(step, steps) {
  return Math.max(0, Math.min(step - 1, steps.length - 1));
}

function ProgressBar({ currentStep, completedSteps, stepLabels, steps }) {
  return (
    <div className="flex items-center gap-1 w-full max-w-2xl mx-auto my-8 flex-wrap">
      {steps.map((step, i) => {
        const done = completedSteps.has(i);
        const active = i === currentStep && !done;
        return (
          <div key={i} className="flex-1 flex flex-col items-center min-w-[60px]">
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors
              ${done ? 'bg-teal-600 border-teal-600 text-white' : active ? 'border-teal-400 text-teal-600 bg-teal-50' : 'border-gray-300 text-gray-400'}
              ${active ? 'ring-2 ring-teal-300' : ''}
            `}>
              {done ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`mt-1 text-[10px] text-center leading-tight ${done ? 'text-teal-700 font-medium' : active ? 'text-teal-600 font-medium' : 'text-gray-400'}`}>
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
  const [specialty, setSpecialty] = useState('');
  const [researchIntent, setResearchIntent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [researchId, setResearchId] = useState(null);
  const [phase, setPhase] = useState('input');
  const [currentStep, setCurrentStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [stepLabels, setStepLabels] = useState({});
  const [progressMsg, setProgressMsg] = useState('');
  const [report, setReport] = useState(null);
  const [useV2, setUseV2] = useState(false);
  const [disambiguation, setDisambiguation] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Elapsed timer for running phase
  useEffect(() => {
    if (phase === 'running') {
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const { user: authUser, updateUser: updateAuthUser } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const isDemo = authUser?.is_demo;
  const maxReports = authUser?.max_reports;
  const reportsUsed = authUser?.reports_used ?? 0;
  const remaining = maxReports != null ? maxReports - reportsUsed : null;
  const atLimit = isDemo && remaining != null && remaining <= 0;

  const steps = useV2 ? STEPS_V2 : STEPS_V1;

  const handleWsMessage = useCallback((data) => {
    if (data.type === 'step_update') {
      const idx = backendStepToIndex(data.step, steps);
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
      setCompletedSteps(new Set(steps.map((_, i) => i)));
      setCurrentStep(steps.length - 1);
      setProgressMsg('Report ready');

      const caseId = data.case_id || researchId;
      addToast('Your report is ready', 'success');
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
      const errMsg = data.error || data.message || 'Research failed';
      setError(errMsg);
      setPhase('error');
      addToast(`Pipeline failed: ${errMsg}`, 'error');
    }
  }, [researchId, steps]);

  useWebSocket(researchId, handleWsMessage, 'cases');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    const isV2 = Boolean(specialty || researchIntent);
    setUseV2(isV2);
    setSubmitting(true);
    setError(null);
    setReport(null);
    setDisambiguation(null);
    setPhase('running');
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setStepLabels({});
    setProgressMsg('Submitting...');

    try {
      const payload = { research_topic: topic.trim() };
      if (specialty) payload.specialty = specialty;
      if (researchIntent) payload.research_intent = researchIntent;

      // Use raw fetch to intercept 409 disambiguation responses
      const token = localStorage.getItem('secnd_token') || '';
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        const data = await res.json();
        setDisambiguation(data);
        setPhase('disambiguate');
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }

      const result = await res.json();
      setResearchId(result.id);
      setCompletedSteps(new Set([0]));
      setProgressMsg('Topic accepted');

      // Refresh user profile
      try { const me = await getMe(); updateAuthUser(me); } catch {}
    } catch (err) {
      setError(err.message);
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmResearch(confirmedTopic) {
    setSubmitting(true);
    setError(null);
    setDisambiguation(null);
    setPhase('running');
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setStepLabels({});
    setProgressMsg('Submitting confirmed topic...');

    try {
      const payload = {
        original_topic: topic.trim(),
        confirmed_topic: confirmedTopic,
        confirmed_as_medical: true,
      };
      if (specialty) payload.specialty = specialty;
      if (researchIntent) payload.research_intent = researchIntent;

      const result = await confirmResearch(payload);
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
    setSpecialty('');
    setResearchIntent('');
    setUseV2(false);
    setDisambiguation(null);
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
          <div className="flex items-center gap-4">
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
          <UserBadge />
          </div>
        </div>
      </header>

      {/* ── Input form ── */}
      {phase === 'input' && (
        <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-gray-900">Deep Research</h1>
          <p className="mt-2 text-gray-500">
            Enter any medical topic to generate a comprehensive research article with citations.
          </p>

          {/* Demo limit banner */}
          {isDemo && remaining != null && remaining > 0 && remaining <= 2 && (
            <div className="mt-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              You have <strong>{remaining} of {maxReports}</strong> reports remaining
            </div>
          )}
          {atLimit && (
            <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
              <strong>Report limit reached</strong> — contact admin for more access
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Research Topic</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={4}
                placeholder="e.g. Differential diagnosis of normocytic anemia in elderly patients with elevated ESR"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition resize-none"
              />
            </div>

            {/* Specialty dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specialty <span className="text-gray-400 font-normal">(optional — enables enhanced pipeline)</span>
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-gray-900 bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition"
              >
                <option value="">Select specialty...</option>
                {SPECIALTIES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Research intent pills */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Research Intent <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {INTENTS.map(intent => (
                  <button
                    key={intent.key}
                    type="button"
                    onClick={() => setResearchIntent(researchIntent === intent.key ? '' : intent.key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all border-2 ${
                      researchIntent === intent.key
                        ? 'bg-teal-100 border-teal-400 text-teal-800'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {intent.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enhanced pipeline indicator */}
            {(specialty || researchIntent) && (
              <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
                <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Enhanced 10-step pipeline</strong> — includes hallucination checks, evidence verification, and citation validation.
                </span>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !topic.trim() || atLimit}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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

      {/* ── Disambiguation ── */}
      {phase === 'disambiguate' && disambiguation && (
        <main className="mx-auto max-w-3xl px-6 py-12 animate-fade-in-up">
          <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-6">
            <div className="flex items-start gap-3 mb-4">
              <svg className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <h2 className="text-lg font-bold text-amber-800">Ambiguous Term Detected</h2>
                <p className="text-sm text-amber-700 mt-1">
                  The term <strong>"{disambiguation.ambiguous_term}"</strong> in your topic has different meanings in medical and non-medical contexts. Please confirm the intended interpretation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {/* Medical interpretation — clickable */}
              <button
                onClick={() => handleConfirmResearch(disambiguation.medical_interpretation || topic.trim())}
                disabled={submitting}
                className="text-left rounded-xl border-2 border-teal-300 bg-white p-4 hover:bg-teal-50 hover:border-teal-400 transition cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">Recommended</span>
                </div>
                <h3 className="font-semibold text-teal-800">Medical Interpretation</h3>
                <p className="text-sm text-teal-700 mt-1">{disambiguation.medical_meaning}</p>
                {disambiguation.medical_interpretation && (
                  <p className="text-xs text-teal-600 mt-2 italic">"{disambiguation.medical_interpretation}"</p>
                )}
              </button>

              {/* Non-medical interpretation — disabled */}
              <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-xs font-semibold rounded-full">Not supported</span>
                </div>
                <h3 className="font-semibold text-gray-500">Non-Medical Interpretation</h3>
                <p className="text-sm text-gray-400 mt-1">{disambiguation.non_medical_meaning}</p>
                {disambiguation.non_medical_interpretation && (
                  <p className="text-xs text-gray-400 mt-2 italic">"{disambiguation.non_medical_interpretation}"</p>
                )}
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => { setDisambiguation(null); setPhase('input'); }}
                className="text-sm text-amber-700 underline hover:text-amber-900 transition"
              >
                Edit my topic instead
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ── Progress ── */}
      {phase === 'running' && (
        <main className="mx-auto max-w-4xl px-6 py-12 animate-fade-in-up">
          <h2 className="text-xl font-bold text-gray-900 text-center">Researching</h2>
          <p className="text-center text-sm text-gray-500 mt-1 truncate max-w-md mx-auto">{topic}</p>
          {(specialty || researchIntent) && (
            <div className="flex justify-center gap-2 mt-2">
              {specialty && (
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">{specialty}</span>
              )}
              {researchIntent && (
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  {INTENTS.find(i => i.key === researchIntent)?.label || researchIntent}
                </span>
              )}
            </div>
          )}
          <ProgressBar currentStep={currentStep} completedSteps={completedSteps} stepLabels={stepLabels} steps={steps} />
          {progressMsg && (
            <p className="text-center text-sm text-teal-600 animate-pulse">{progressMsg}</p>
          )}
          {elapsed > 0 && (
            <p className="text-center text-xs text-gray-400 mt-2">Elapsed: {elapsed}s</p>
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
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
              {specialty && (
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">{specialty}</span>
              )}
              {researchIntent && (
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                  {INTENTS.find(i => i.key === researchIntent)?.label || researchIntent}
                </span>
              )}
              {report.total_sources > 0 && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  {report.total_sources} sources
                </span>
              )}
            </div>
          </div>

          <ResearchReportViewer
            report={report}
            caseId={caseId}
            specialty={specialty}
            researchIntent={researchIntent}
            useV2={useV2}
          />
        </main>
      )}
    </div>
  );
}
