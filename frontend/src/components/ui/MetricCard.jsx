import { TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricCard({ icon, label, value, subtitle, trend, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5 flex flex-col gap-3 ${className}`}>
      <div className="flex items-start justify-between">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-[#E8F5EE] flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              trend === 'up'
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-700'
            }`}
          >
            {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend === 'up' ? 'Rising' : 'Falling'}
          </div>
        )}
      </div>
      <div>
        <p className="text-[#6B7280] text-sm font-medium">{label}</p>
        <p className="text-2xl font-bold text-[#1A2332] mt-0.5 leading-tight">{value}</p>
        {subtitle && <p className="text-[#9CA3AF] text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
