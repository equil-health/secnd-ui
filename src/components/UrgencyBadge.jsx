import { useState } from 'react';

const TIER_CONFIG = {
  ALERT: { label: 'ALERT', icon: '\u{1F6A8}', classes: 'bg-red-100 text-red-800' },
  MAJOR: { label: 'MAJOR', icon: '\u26A1',    classes: 'bg-amber-100 text-amber-800' },
  NEW:   { label: 'NEW',   icon: '\u{1F4C4}', classes: 'bg-gray-100 text-gray-600' },
};

export default function UrgencyBadge({ tier, reason }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = TIER_CONFIG[tier] || TIER_CONFIG.NEW;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => reason && setShowTooltip(!showTooltip)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${config.classes} ${reason ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span>{config.icon}</span>
        {config.label}
      </button>
      {showTooltip && reason && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-gray-900 text-white text-xs rounded-md px-3 py-2 max-w-[260px] shadow-lg">
          {reason}
        </div>
      )}
    </span>
  );
}
