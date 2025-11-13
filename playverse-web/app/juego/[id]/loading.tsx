export default function GameDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          {/* Back button skeleton */}
          <div className="h-10 w-24 bg-slate-700 rounded mb-8"></div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left column skeleton */}
            <div className="space-y-4">
              <div className="aspect-video bg-slate-700 rounded-lg"></div>
              <div className="grid grid-cols-4 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-video bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>

            {/* Right column skeleton */}
            <div className="space-y-6">
              <div className="bg-slate-700 rounded-lg p-6">
                <div className="h-6 bg-slate-600 rounded mb-4"></div>
                <div className="h-8 bg-slate-600 rounded mb-2"></div>
                <div className="h-4 bg-slate-600 rounded mb-4"></div>
                <div className="space-y-3">
                  <div className="h-12 bg-slate-600 rounded"></div>
                  <div className="h-12 bg-slate-600 rounded"></div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-12 bg-slate-600 rounded"></div>
                    <div className="w-12 h-12 bg-slate-600 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
