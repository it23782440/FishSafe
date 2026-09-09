'use client';

const RANGES = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

export default function TimeRangeSelector({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1 text-sm rounded-md font-medium transition ${
            value === r.value
              ? 'bg-sky-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
