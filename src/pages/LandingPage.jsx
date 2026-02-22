import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CARDS = [
  {
    id: 'second-opinion',
    title: 'Second Opinion',
    description:
      'Submit a clinical case and receive an AI-powered second opinion backed by evidence search, hallucination checking, and deep research.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    accent: 'indigo',
  },
  {
    id: 'research',
    title: 'Research Base',
    description:
      'Run standalone deep research on any medical topic. Generates a comprehensive article with citations using STORM methodology.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    accent: 'teal',
  },
];

const accentClasses = {
  indigo: {
    border: 'border-indigo-200 hover:border-indigo-400',
    icon: 'bg-indigo-100 text-indigo-600',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    buttonOutline: 'border border-indigo-300 text-indigo-700 hover:bg-indigo-50',
  },
  teal: {
    border: 'border-teal-200 hover:border-teal-400',
    icon: 'bg-teal-100 text-teal-600',
    button: 'bg-teal-600 hover:bg-teal-700 text-white',
    buttonOutline: 'border border-teal-300 text-teal-700 hover:bg-teal-50',
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  function handleCardClick(card) {
    if (card.id === 'research') {
      navigate('/research');
    } else {
      setExpanded((prev) => !prev);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-600">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32 text-center">
          <h1 className="animate-fade-in-up text-5xl sm:text-6xl font-extrabold tracking-tight text-white">
            SECND
          </h1>
          <p className="animate-fade-in-up animate-delay-100 mt-4 text-lg sm:text-xl text-indigo-100 max-w-2xl mx-auto">
            AI-Powered Medical Intelligence
          </p>
          <p className="animate-fade-in-up animate-delay-200 mt-2 text-sm text-indigo-200/80 max-w-xl mx-auto">
            Evidence-backed second opinions and deep research, powered by multi-agent AI pipelines.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-5xl px-6 -mt-12 pb-20">
        <div className="grid gap-6 sm:grid-cols-2">
          {CARDS.map((card, i) => {
            const ac = accentClasses[card.accent];
            const isSecondOpinion = card.id === 'second-opinion';
            const isExpanded = isSecondOpinion && expanded;

            return (
              <div
                key={card.id}
                className={`animate-fade-in-up ${i === 1 ? 'animate-delay-100' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => handleCardClick(card)}
                  className={`w-full text-left rounded-2xl bg-white shadow-lg border-2 ${ac.border} p-8 transition-all duration-200 hover:shadow-xl`}
                >
                  <div className={`inline-flex items-center justify-center rounded-xl ${ac.icon} p-3 mb-4`}>
                    {card.icon}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{card.title}</h2>
                  <p className="mt-2 text-gray-600 leading-relaxed">{card.description}</p>

                  {isSecondOpinion && (
                    <div className="mt-3 flex items-center text-sm text-indigo-500 font-medium">
                      {expanded ? 'Choose a mode' : 'Click to explore'}
                      <svg
                        className={`ml-1 w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}

                  {!isSecondOpinion && (
                    <div className="mt-3 flex items-center text-sm text-teal-500 font-medium">
                      Start researching
                      <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Expanded sub-options */}
                {isExpanded && (
                  <div className="mt-3 grid grid-cols-2 gap-3 animate-fade-in-up">
                    <button
                      onClick={() => navigate('/demo')}
                      className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${ac.buttonOutline}`}
                    >
                      Demo Mode
                      <span className="block text-xs font-normal mt-0.5 opacity-70">Pre-built scenarios</span>
                    </button>
                    <button
                      onClick={() => navigate('/submit')}
                      className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${ac.button}`}
                    >
                      Chat Mode
                      <span className="block text-xs font-normal mt-0.5 opacity-80">Submit your case</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
