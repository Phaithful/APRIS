const config = {
  low: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    dot: 'bg-green-500',
    pulse: false,
  },
  medium: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    pulse: false,
  },
  high: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    dot: 'bg-red-500',
    pulse: true,
  },
  critical: {
    bg: 'bg-red-600',
    text: 'text-white',
    dot: 'bg-white',
    pulse: true,
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
};

export default function RiskBadge({ level = 'low', size = 'md' }) {
  const cfg = config[level] || config.low;
  const sz = sizeClasses[size] || sizeClasses.md;
  const label = level.charAt(0).toUpperCase() + level.slice(1);

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${cfg.bg} ${cfg.text} ${sz}`}
    >
      {cfg.pulse ? (
        <span className="relative flex items-center justify-center">
          <span
            className={`absolute inline-flex rounded-full ${cfg.dot} opacity-75 animate-ping`}
            style={{ width: '8px', height: '8px' }}
          />
          <span
            className={`relative inline-flex rounded-full ${cfg.dot}`}
            style={{ width: '8px', height: '8px' }}
          />
        </span>
      ) : (
        <span
          className={`inline-flex rounded-full ${cfg.dot}`}
          style={{ width: '6px', height: '6px' }}
        />
      )}
      {label}
    </span>
  );
}
