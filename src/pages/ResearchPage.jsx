import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { submitResearch } from '../utils/api';
import useWebSocket from '../hooks/useWebSocket';

const STEPS = [
  { label: 'Submitting', key: 'submitted' },
  { label: 'Researching', key: 'researching' },
  { label: 'Writing', key: 'writing' },
  { label: 'Complete', key: 'complete' },
];

function stepIndex(status) {
  if (!status) return -1;
  if (status === 'complete' || status === 'completed') return 3;
  if (status === 'writing') return 2;
  if (status === 'researching') return 1;
  return 0;
}

function ProgressBar({ currentStep }) {
  return (
    <div className="flex items-center gap-1 w-full max-w-md mx-auto my-8">
      {STEPS.map((step, i) => {
        const done = i <= currentStep;
        const active = i === currentStep;
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
              ${done ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 text-gray-400'}
              ${active ? 'ring-2 ring-teal-300' : ''}
            `}>
              {done && i < currentStep ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`mt-1 text-xs ${done ? 'text-teal-700 font-medium' : 'text-gray-400'}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-full mt-1 ${i < currentStep ? 'bg-teal-500' : 'bg-gray-200'}`} />
            )}
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
  const [status, setStatus] = useState(null);
  const [article, setArticle] = useState(null);
  const [sources, setSources] = useState([]);
  const [progressMsg, setProgressMsg] = useState('');

  const handleWsMessage = useCallback((data) => {
    if (data.status) setStatus(data.status);
    if (data.message) setProgressMsg(data.message);
    if (data.type === 'complete' || data.status === 'completed') {
      setStatus('complete');
      if (data.article) setArticle(data.article);
      if (data.sources) setSources(data.sources);
    }
    if (data.type === 'error') {
      setError(data.message || 'Research failed');
      setStatus('error');
    }
  }, []);

  useWebSocket(researchId, handleWsMessage, 'research');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setSubmitting(true);
    setError(null);
    setArticle(null);
    setSources([]);
    setStatus('submitted');
    setProgressMsg('');

    try {
      const result = await submitResearch(topic.trim());
      setResearchId(result.id);
    } catch (err) {
      setError(err.message);
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  const isRunning = status && status !== 'complete' && status !== 'error';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-teal-700 hover:text-teal-600 transition">
            SECND <span className="text-sm font-normal text-gray-400 ml-1">Research Base</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Input form — shown when no research is running */}
        {!researchId && (
          <div className="animate-fade-in-up">
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

              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}

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
          </div>
        )}

        {/* Progress */}
        {researchId && isRunning && (
          <div className="animate-fade-in-up">
            <h2 className="text-xl font-bold text-gray-900 text-center">Researching</h2>
            <p className="text-center text-sm text-gray-500 mt-1 truncate max-w-md mx-auto">{topic}</p>
            <ProgressBar currentStep={stepIndex(status)} />
            {progressMsg && (
              <p className="text-center text-sm text-teal-600 animate-pulse">{progressMsg}</p>
            )}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="animate-fade-in-up mt-8 rounded-xl bg-red-50 border border-red-200 p-6 text-center">
            <p className="text-red-700 font-medium">Research failed</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={() => { setResearchId(null); setStatus(null); setError(null); }}
              className="mt-4 text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* Completed article */}
        {status === 'complete' && article && (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Research Article</h2>
              <button
                onClick={() => { setResearchId(null); setStatus(null); setArticle(null); setSources([]); setTopic(''); }}
                className="text-sm text-teal-600 hover:text-teal-800 font-medium"
              >
                New Research
              </button>
            </div>

            <article className="prose prose-gray max-w-none bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <ReactMarkdown>{article}</ReactMarkdown>
            </article>

            {sources.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Sources ({sources.length})</h3>
                <ul className="space-y-2">
                  {sources.map((src, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-700 hover:underline font-medium"
                        >
                          {src.title || src.url}
                        </a>
                        {src.snippet && (
                          <p className="text-gray-500 mt-0.5">{src.snippet}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
