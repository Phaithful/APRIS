import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fmtChartDate } from '../../utils/dateFormat';

function getRiskColor(score) {
  if (score > 70) return '#DC2626';
  if (score > 35) return '#D97706';
  return '#2E7D52';
}

function CustomDot(props) {
  const { cx, cy, payload } = props;
  const color = getRiskColor(payload.risk_score);
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={2} />;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value;
  const color = getRiskColor(score);
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="text-[#6B7280] mb-1">{label}</p>
      <p className="font-bold" style={{ color }}>Risk Score: {score}</p>
    </div>
  );
}

export default function RiskTrendChart({ data = [] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: fmtChartDate(d.date),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={70}
          stroke="#DC2626"
          strokeDasharray="4 4"
          label={{ value: 'High Threshold', position: 'insideTopRight', fontSize: 11, fill: '#DC2626' }}
        />
        <ReferenceLine
          y={35}
          stroke="#D97706"
          strokeDasharray="4 4"
          label={{ value: 'Medium Threshold', position: 'insideTopRight', fontSize: 11, fill: '#D97706' }}
        />
        <Line
          type="monotone"
          dataKey="risk_score"
          stroke="#2E7D52"
          strokeWidth={2.5}
          dot={<CustomDot />}
          activeDot={{ r: 6 }}
          name="Risk Score"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
