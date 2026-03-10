export default function SpecialtyTabs({ specialties, active, onSelect, alertSpecialties = [] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {specialties.map((sp) => {
        const isActive = sp === active;
        const hasAlert = alertSpecialties.includes(sp);

        return (
          <button
            key={sp}
            onClick={() => onSelect(sp)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
              ${isActive
                ? 'bg-[#0F2C5C] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {sp}
            {hasAlert && (
              <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
            )}
          </button>
        );
      })}
    </div>
  );
}
