export default function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="animate-pulse">
      {/* Header row */}
      <div className="flex gap-4 px-4 py-3 bg-gray-100 rounded-t-lg">
        {[...Array(cols)].map((_, i) => (
          <div key={i} className="flex-1 h-3 bg-gray-300 rounded" />
        ))}
      </div>
      {/* Data rows */}
      <div className="border rounded-b-lg divide-y">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-3">
            {[...Array(cols)].map((_, c) => (
              <div
                key={c}
                className="flex-1 h-3 bg-gray-200 rounded"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
