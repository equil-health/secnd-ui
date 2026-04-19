import { useEffect, useState, useMemo } from 'react';

// Claude-CLI-style goofy gerunds. Purely whimsical — no reference to
// the case, medicine, or any internal stage. Just something to watch
// while the pipeline grinds.
const THINKING_PHRASES = [
  'Perambulating',
  'Bamboozling',
  'Flibbertigibbeting',
  'Noodling',
  'Kerfuffling',
  'Discombobulating',
  'Befuddling',
  'Hobnobbing',
  'Galumphing',
  'Skedaddling',
  'Confabulating',
  'Lollygagging',
  'Whiffling',
  'Snollygostering',
  'Boondoggling',
  'Gallivanting',
  'Rumpusing',
  'Wobbulating',
  'Flummoxing',
  'Finagling',
  'Hornswoggling',
  'Persnicketing',
  'Wafflestomping',
  'Tittering',
  'Dillydallying',
  'Futzing',
  'Gobsmacking',
  'Harrumphing',
  'Absquatulating',
  'Kerplunking',
  'Whomping',
  'Bumblefussing',
  'Collywobbling',
  'Shilly-shallying',
  'Mollycoddling',
  'Malarkeying',
  'Hootenannying',
  'Ballyhooing',
  'Higgledy-piggledying',
  'Cattywampussing',
];

function useRotatingPhrase(intervalMs = 4500) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return THINKING_PHRASES[tick % THINKING_PHRASES.length];
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
      <div className="relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900" />
        <div className="px-5 py-4 pl-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="eyebrow text-slate-500">Submitted Case</span>
              {pcBits.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600">
                  {pcBits.map((b, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200"
                    >
                      {b}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <span className="stat-value text-[11px] text-slate-400">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <p className="text-[15px] text-slate-800 whitespace-pre-wrap leading-relaxed">
            {truncate(caseText)}
          </p>
        </div>
      </div>

      {/* Ruminating card — dark, confident */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-900/20">
        {/* Animated mesh background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.4), transparent 50%), radial-gradient(ellipse at bottom right, rgba(16,185,129,0.25), transparent 50%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative px-6 py-7">
          <div className="flex items-start gap-4">
            <div className="relative w-6 h-6 flex-shrink-0 mt-1.5">
              <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-40 animate-ping" />
              <div className="absolute inset-[3px] rounded-full bg-gradient-to-br from-indigo-400 to-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                key={phrase}
                className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white italic"
                style={{
                  animation: 'fadeSlide 600ms ease-out',
                  fontVariationSettings: "'SOFT' 40, 'opsz' 72, 'wght' 600",
                }}
              >
                {phrase}
                <span className="inline-block ml-1 text-indigo-400 animate-pulse not-italic">…</span>
              </div>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="stat-value text-sm text-white tabular-nums">
                  {formatElapsed(elapsedMs)}
                </span>
                <span className="text-slate-600">/</span>
                {queued ? (
                  <span className="text-[11px] font-medium text-amber-300">
                    {position > 0
                      ? `Queued · ~${position} ahead`
                      : 'Queued · picking up shortly'}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    Typical ~3 min
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
