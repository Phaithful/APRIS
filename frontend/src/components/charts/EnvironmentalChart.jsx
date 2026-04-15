import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fmtChartDate } from '../../utils/dateFormat';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="text-[#6B7280] mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}
          {p.dataKey === 'humidity' ? '%' : '°C'}
        </p>
      ))}
    </div>
  );
}

export default function EnvironmentalChart({ data = [] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: fmtChartDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={formatted} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        {/* Left Y axis: Temperature */}
        <YAxis
          yAxisId="temp"
          orientation="left"
          tick={{ fontSize: 11, fill: '#F87171' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}°`}
        />
        {/* Right Y axis: Humidity */}
        <YAxis
          yAxisId="hum"
          orientation="right"
          tick={{ fontSize: 11, fill: '#60A5FA' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
          formatter={(value) => <span className="text-[#374151]">{value}</span>}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temperature"
          stroke="#F87171"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#F87171', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          name="Temperature (°C)"
        />
        <Line
          yAxisId="hum"
          type="monotone"
          dataKey="humidity"
          stroke="#60A5FA"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#60A5FA', stroke: 'white', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          name="Humidity (%)"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
