import useAppStore from '../stores/appStore';

const STATUS_STYLES = {
  running: {
    dot: 'bg-indigo-500 animate-pulse',
    border: 'border-indigo-500',
    text: 'text-indigo-700',
    icon: '⟳',
  },
  done: {
    dot: 'bg-green-500',
    border: 'border-green-500',
    text: 'text-green-700',
    icon: '✓',
  },
  waiting: {
    dot: 'bg-gray-300',
    border: 'border-gray-300',
    text: 'text-gray-400',
    icon: '○',
  },
  error: {
    dot: 'bg-red-500',
    border: 'border-red-500',
    text: 'text-red-700',
    icon: '✗',
  },
};

export default function PipelineTracker() {
  const { pipelineSteps, pipelineStatus } = useAppStore();

  if (!pipelineSteps || pipelineSteps.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Pipeline Progress</h3>
      <div className="space-y-0">
        {pipelineSteps.map((step, i) => {
          const s = STATUS_STYLES[step.status] || STATUS_STYLES.waiting;
          const isLast = i === pipelineSteps.length - 1;
          return (
            <div key={i} className="flex gap-3 transition-all duration-300">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${s.dot} transition-all duration-300`}
                >
                  {step.status === 'running' ? (
                    <span className="animate-spin inline-block">⟳</span>
                  ) : (
                    s.icon
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 h-8 ${
                      step.status === 'done' ? 'bg-green-300' : 'bg-gray-200'
                    } transition-colors duration-300`}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pb-4 min-w-0">
                <p className={`text-sm font-medium ${s.text} transition-colors duration-300`}>
                  {step.label || `Step ${step.step + 1}`}
                </p>
                {step.preview && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {step.preview}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {step.duration_s != null && (
                    <span className="text-[10px] text-gray-400">
                      {step.duration_s.toFixed(1)}s
                    </span>
                  )}
                  {step.progress && (
                    <span className="text-[10px] text-indigo-500 font-medium">
                      {step.progress}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {pipelineStatus === 'complete' && (
        <p className="text-xs text-green-600 font-medium mt-2">Pipeline complete</p>
      )}
      {pipelineStatus === 'error' && (
        <p className="text-xs text-red-600 font-medium mt-2">Pipeline encountered an error</p>
      )}
    </div>
  );
}
