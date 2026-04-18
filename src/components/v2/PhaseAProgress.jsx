import { STAGE_LABELS, STAGE_ORDER } from '../../utils/sdssV2Api';

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function PhaseAProgress({ stagesCompleted, currentStage, elapsedMs, queuePosition, queueInfo, queued }) {
  const completedSet = new Set(stagesCompleted.map((s) => s.stage));
  const durationMap = Object.fromEntries(stagesCompleted.map((s) => [s.stage, s.duration_ms]));

  // Derive a position estimate from queue_info when the backend hasn't
  // sent queue_position explicitly. The case joined at the tail of in_flight.
  const positionHint = queuePosition > 0
    ? queuePosition
    : (queueInfo && queueInfo.max_workers != null
      ? Math.max(0, queueInfo.in_flight - queueInfo.max_workers)
      : 0);

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span className="text-sm font-semibold text-purple-800">
          {queued ? 'Waiting for GPU worker' : 'Generating Verified Second Opinion'}
        </span>
        <span className="text-xs text-purple-500 ml-auto tabular-nums">{formatElapsed(elapsedMs)}</span>
      </div>

      {queued && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <div className="font-medium">Your case is queued.</div>
          <div className="text-amber-600 mt-0.5">
            {positionHint > 0
              ? `Approximately ${positionHint} case${positionHint === 1 ? '' : 's'} ahead of yours.`
              : 'A worker will pick this up shortly.'}
            {queueInfo?.max_workers
              ? ` (${queueInfo.max_workers} worker${queueInfo.max_workers === 1 ? '' : 's'} active)`
              : ''}
          </div>
        </div>
      )}

      {!queued && positionHint > 0 && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
          Queue position: #{positionHint} — waiting for GPU
        </div>
      )}

      <div className="space-y-1.5">
        {STAGE_ORDER.map((stage) => {
          const done = completedSet.has(stage);
          const active = stage === currentStage;
          const label = STAGE_LABELS[stage] || stage;
          const dur = durationMap[stage];

          // Skip image_analysis if it completed with 0ms (no images)
          if (stage === 'image_analysis' && done && dur === 0) return null;

          return (
            <div key={stage} className="flex items-center gap-2 text-sm">
              {done ? (
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : active ? (
                <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                </div>
              )}
              <span className={
                done ? 'text-green-700' : active ? 'text-purple-700 font-medium' : 'text-gray-400'
              }>
                {label}
              </span>
              {done && dur > 0 && (
                <span className="text-[10px] text-gray-400 tabular-nums ml-auto">{formatMs(dur)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
