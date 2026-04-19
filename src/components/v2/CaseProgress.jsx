import { useEffect, useState, useMemo } from 'react';

// Claude-CLI-style verbs that rotate while the pipeline runs. Each entry
// has a present-continuous verb and an ambiguous noun — enough to feel
// like the system is thinking, without claiming a specific stage.
const THINKING_VERBS = [
  'Pondering',
  'Ruminating',
  'Triangulating',
  'Cross-referencing',
  'Deliberating',
  'Interrogating',
  'Contemplating',
  'Reconciling',
  'Synthesising',
  'Scrutinising',
  'Weighing',
  'Investigating',
  'Cogitating',
  'Distilling',
  'Percolating',
  'Corroborating',
  'Dissecting',
  'Consulting',
  'Navigating',
  'Parsing',
  'Mulling',
  'Enumerating',
  'Sifting',
  'Interpreting',
];

const THINKING_OBJECTS = [
  'the differential',
  'the literature',
  'the evidence base',
  'candidate diagnoses',
  'lab thresholds',
  'knowledge-graph paths',
  'contraindications',
  'must-exclude diagnoses',
  'guideline citations',
  'treatment holds',
  'the clinical timeline',
  'the case narrative',
  'symptom clusters',
  'completeness gaps',
  'evidence quality tiers',
  'verification signals',
];

function useRotatingPhrase(intervalMs = 2400) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  // Avoid repeating the same verb twice in a row; seed from tick.
  const verb = THINKING_VERBS[tick % THINKING_VERBS.length];
  const obj = THINKING_OBJECTS[(tick * 7) % THINKING_OBJECTS.length];
  return `${verb} ${obj}`;
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function truncate(text, max = 800) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export default function CaseProgress({
  caseText,
  patientContext,
  elapsedMs,
  queued,
  queueInfo,
}) {
  const phrase = useRotatingPhrase(2400);

  const pcBits = useMemo(() => {
    if (!patientContext) return [];
    const bits = [];
    if (patientContext.age != null) bits.push(`${patientContext.age}y`);
    if (patientContext.sex) bits.push(patientContext.sex);
    if (patientContext.comorbidities?.length) {
      bits.push(`${patientContext.comorbidities.length} comorbid`);
    }
    if (patientContext.current_medications?.length) {
      bits.push(`${patientContext.current_medications.length} meds`);
    }
    if (patientContext.labs?.length) {
      bits.push(`${patientContext.labs.length} labs`);
    }
    return bits;
  }, [patientContext]);

  const position = queued && queueInfo && queueInfo.max_workers != null
    ? Math.max(0, queueInfo.in_flight - queueInfo.max_workers)
    : 0;

  return (
    <div className="space-y-4">
      {/* Case preview card */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
              Submitted case
            </span>
            {pcBits.length > 0 && (
              <span className="text-[10px] text-gray-400">•</span>
            )}
            {pcBits.length > 0 && (
              <span className="text-[11px] text-gray-500">
                {pcBits.join(' • ')}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {truncate(caseText)}
        </p>
      </div>

      {/* Ruminating card — rotates verb every ~2.4s */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="relative w-5 h-5 flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-30 animate-ping" />
            <div className="absolute inset-1 rounded-full bg-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              key={phrase}
              className="text-base font-medium text-indigo-900 animate-fade-in"
              style={{ animation: 'fadeSlide 400ms ease-out' }}
            >
              {phrase}
              <span className="inline-block ml-1 animate-pulse">…</span>
            </div>
            {queued ? (
              <div className="text-[11px] text-amber-700 mt-1">
                {position > 0
                  ? `Queued — approximately ${position} case${position === 1 ? '' : 's'} ahead.`
                  : 'Queued — a worker will pick this up shortly.'}
              </div>
            ) : (
              <div className="text-[11px] text-indigo-500 mt-1">
                This typically takes about 3 minutes.
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
