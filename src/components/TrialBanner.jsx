export default function TrialBanner({ trialStatus, onUpgrade }) {
  if (!trialStatus || trialStatus.tier) return null;

  const remaining = (trialStatus.limit || 4) - (trialStatus.free_reports_used || 0);
  const total = trialStatus.limit || 4;

  let bg, text;
  if (remaining >= 2) {
    bg = 'bg-green-50';
    text = 'text-green-800';
  } else if (remaining === 1) {
    bg = 'bg-amber-50';
    text = 'text-amber-800';
  } else {
    bg = 'bg-red-50';
    text = 'text-red-800';
  }

  return (
    <div className={`${bg} px-4 py-1.5 flex items-center justify-between text-xs font-medium ${text}`}>
      <span>
        {remaining > 0
          ? `${remaining} of ${total} free reports remaining`
          : `All ${total} free reports used this month`}
      </span>
      {remaining <= 0 && onUpgrade && (
        <button onClick={onUpgrade} className="font-bold hover:underline">
          Upgrade &rarr;
        </button>
      )}
    </div>
  );
}
