export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export function ErrorState({ message }) {
  return (
    <div className="card border-red-200 bg-red-50 text-red-700">
      <p className="font-semibold">Could not load data</p>
      <p className="text-sm mt-1 break-all">{message}</p>
      <p className="text-xs mt-2 text-red-500">
        Check that NEXT_PUBLIC_API_BASE_URL points to a running backend and that
        CORS allows this origin.
      </p>
    </div>
  );
}

export function EmptyState({ message = 'No data yet.' }) {
  return (
    <div className="card text-center text-slate-500 py-10">
      <div className="text-3xl mb-2">📭</div>
      {message}
    </div>
  );
}
