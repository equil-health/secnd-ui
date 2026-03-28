import { useState, useEffect, useRef } from 'react';
import FormattedMarkdown from '../utils/formatReport';

const CONFIDENCE_COLORS = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-red-100 text-red-800',
};

function isVerified(answer) {
  return String(answer).toLowerCase() === 'true';
}

function hasCaution(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes('caution') || lower.includes('critical safety') || lower.includes('urgent');
}

const PIPELINE_STEPS = [
  { label: 'Parsing clinical query', duration: 3 },
  { label: 'Decomposing into biomedical triplets', duration: 8 },
  { label: 'Querying knowledge graph adapters', duration: 15 },
  { label: 'Verifying relationships', duration: 12 },
  { label: 'Synthesising clinical answer', duration: 10 },
];

export default function SecondOpinionPanel({ loading, result, error }) {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const stepTimerRef = useRef(null);

  // Elapsed timer
  useEffect(() => {
    if (loading) {
      const start = Date.now();
      setElapsed(0);
      setActiveStep(0);
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [loading]);

  // Step progression
  useEffect(() => {
    if (loading) {
      let stepIdx = 0;
      setActiveStep(0);

      const advance = () => {
        stepIdx++;
        if (stepIdx < PIPELINE_STEPS.length) {
          setActiveStep(stepIdx);
          stepTimerRef.current = setTimeout(advance, PIPELINE_STEPS[stepIdx].duration * 1000);
        }
      };
      stepTimerRef.current = setTimeout(advance, PIPELINE_STEPS[0].duration * 1000);
    } else {
      clearTimeout(stepTimerRef.current);
    }
    return () => clearTimeout(stepTimerRef.current);
  }, [loading]);

  return (
    <div className="space-y-5">
      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Progress dialog */}
      {loading && (
        <div className="bg-white border-2 border-purple-200 rounded-xl shadow-lg overflow-hidden">
          {/* Header with elapsed timer */}
          <div className="bg-purple-50 px-5 py-4 border-b border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-bold text-purple-900">Analysing your case</p>
                  <p className="text-xs text-purple-500">Please wait while we verify biomedical relationships</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-mono font-bold text-purple-700">
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                </p>
                <p className="text-[10px] text-purple-400 uppercase tracking-wider">Elapsed</p>
              </div>
            </div>
          </div>

          {/* Pipeline steps */}
          <div className="px-5 py-4 space-y-1">
            {PIPELINE_STEPS.map((step, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              return (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-500 ${
                  isActive ? 'bg-purple-50 border border-purple-200' : isDone ? 'bg-green-50/50' : ''
                }`}>
                  <div className="w-7 h-7 flex-shrink-0">
                    {isDone ? (
                      <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isActive ? (
                      <div className="w-7 h-7 rounded-full border-2 border-purple-400 bg-white flex items-center justify-center">
                        <div className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-300">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                    )}
                  </div>

                  <span className={`text-sm transition-colors duration-300 ${
                    isDone ? 'text-green-700 font-medium' : isActive ? 'text-purple-800 font-semibold' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>

                  {isActive && (
                    <span className="ml-auto relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom hint */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">
              This typically takes 30–60 seconds depending on query complexity
            </p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Clinical Answer */}
          <div className={`bg-white border rounded-xl border-l-4 shadow-sm ${
            result.has_critical_safety_flag || hasCaution(result.clinical_answer)
              ? 'border-l-red-400'
              : 'border-l-indigo-400'
          }`}>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-800">Clinical Answer</h4>
                {(result.has_critical_safety_flag || hasCaution(result.clinical_answer)) && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Clinical Alert
                  </span>
                )}
              </div>
              {result.query_intent && (
                <p className="text-xs text-indigo-600 font-medium mb-2">Intent: {result.query_intent}</p>
              )}
              <div className="prose prose-sm max-w-none">
                <FormattedMarkdown content={result.clinical_answer} />
              </div>
              {result.total_latency_ms > 0 && (
                <p className="text-[10px] text-gray-400 mt-3">
                  Analysis time: {result.total_latency_ms >= 60000
                    ? `${Math.floor(result.total_latency_ms / 60000)}m ${Math.round((result.total_latency_ms % 60000) / 1000)}s`
                    : `${(result.total_latency_ms / 1000).toFixed(1)}s`
                  }
                </p>
              )}
            </div>
          </div>

          {/* Verified Triplets */}
          {result.triplets_verified?.length > 0 && (
            <div className="bg-white border rounded-xl shadow-sm">
              <div className="px-5 py-4">
                <h4 className="text-sm font-bold text-gray-800 mb-3">
                  Verified Biomedical Relationships ({result.triplets_verified.length})
                </h4>
                <div className="space-y-2">
                  {result.triplets_verified.map((t, i) => {
                    const verified = isVerified(t.answer);
                    return (
                      <div key={i} className={`flex flex-col gap-1.5 p-3 rounded-lg border ${
                        verified ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Verdict icon */}
                          {verified ? (
                            <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-medium rounded">
                            {t.head}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{t.relation}</span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-medium rounded">
                            {t.tail}
                          </span>
                          {t.confidence && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${CONFIDENCE_COLORS[t.confidence] || 'bg-gray-100 text-gray-600'}`}>
                              {t.confidence}
                            </span>
                          )}
                          {t.priority && (
                            <span className="text-[10px] text-gray-400 uppercase">{t.priority}</span>
                          )}
                        </div>
                        {t.clinical_note && (
                          <p className="text-xs text-gray-600 ml-7">{t.clinical_note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
