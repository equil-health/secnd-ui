export default function ReferenceList({ references }) {
  if (!references || references.length === 0) return null;

  return (
    <div className="bg-white border rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        References
      </h4>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {references.map((ref) => (
          <li key={ref.id} id={`ref-${ref.id}`} className="text-sm">
            <span className="text-indigo-600 font-medium mr-1">[{ref.id}]</span>
            {ref.url ? (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-800 hover:text-indigo-600 hover:underline"
              >
                {ref.title || ref.url}
              </a>
            ) : (
              <span className="text-gray-800">{ref.title}</span>
            )}
            {ref.snippet && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                {ref.snippet}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
