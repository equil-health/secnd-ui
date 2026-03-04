export default function SkeletonReport() {
  return (
    <div className="animate-pulse flex gap-4">
      {/* Main content */}
      <div className="flex-1 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>

        {/* Summary block */}
        <div className="bg-gray-200 rounded-lg h-32 w-full" />

        {/* Claims cards */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-5/6" />
            </div>
          ))}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="hidden lg:block w-72 space-y-4">
        <div className="h-20 bg-gray-200 rounded-lg" />
        <div className="h-32 bg-gray-200 rounded-lg" />
        <div className="h-48 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}
