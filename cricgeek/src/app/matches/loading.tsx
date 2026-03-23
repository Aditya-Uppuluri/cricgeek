// Shown by Next.js while the server component fetches data on initial load

function MatchCardSkeleton() {
  return (
    <div className="bg-cg-dark-2 border border-gray-800 rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-10 bg-gray-700 rounded-full" />
        <div className="h-4 w-12 bg-gray-700 rounded-full" />
      </div>
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-700" />
            <div className="h-4 w-20 bg-gray-700 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-700 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-700" />
            <div className="h-4 w-24 bg-gray-700 rounded" />
          </div>
          <div className="h-4 w-10 bg-gray-700 rounded" />
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-gray-800/70 space-y-1.5">
        <div className="h-3 w-3/4 bg-gray-700 rounded" />
        <div className="h-2.5 w-1/2 bg-gray-800 rounded" />
      </div>
    </div>
  );
}

export default function MatchesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="h-8 w-8 bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Format filter skeleton */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-7 w-14 bg-gray-800 rounded-full animate-pulse" />
        ))}
      </div>

      {/* Live section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-gray-700 rounded-full" />
          <div className="h-5 w-20 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <MatchCardSkeleton key={i} />)}
        </div>
      </section>

      {/* Upcoming section */}
      <section>
        <div className="h-5 w-24 bg-gray-700 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <MatchCardSkeleton key={i} />)}
        </div>
      </section>
    </div>
  );
}
