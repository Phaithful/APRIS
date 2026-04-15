import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtChartDate } from '../../utils/dateFormat';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="text-[#6B7280] mb-1">{label}</p>
      <p className="font-bold text-red-700">
        {Number(payload[0]?.value).toFixed(2)}%
      </p>
    </div>
  );
}

export default function MortalityChart({ data = [] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: fmtChartDate(d.date),
    mortality_rate: typeof d.mortality_rate === 'number' ? d.mortality_rate : parseFloat(d.mortality_rate) || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={formatted} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="mortalityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#DC2626" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="mortality_rate"
          stroke="#B91C1C"
          strokeWidth={2.5}
          fill="url(#mortalityGrad)"
          name="Mortality Rate"
          dot={{ r: 3, fill: '#B91C1C', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
