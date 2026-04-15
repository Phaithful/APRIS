export function SkeletonCard({ className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5 animate-pulse ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-6 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
      </div>
    </div>
  );
}

export function SkeletonRow({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 py-3 animate-pulse ${className}`}>
      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-2.5 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="w-16 h-6 bg-gray-200 rounded-full" />
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 bg-gray-200 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export default SkeletonCard;
