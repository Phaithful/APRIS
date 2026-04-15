import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#DC2626', '#D97706', '#2E7D52', '#60A5FA', '#A855F7', '#EC4899'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-[#1A2332] mb-0.5 capitalize">{name}</p>
      <p className="text-[#6B7280]">Occurrences: <span className="font-bold text-[#1A2332]">{value}</span></p>
    </div>
  );
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function DiseaseFreqChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[280px] text-[#9CA3AF] text-sm">
        No disease data for this period
      </div>
    );
  }

  const formatted = data.map((d) => ({
    name: (d.disease_name || '').replace(/_/g, ' '),
    value: Number(d.count),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={formatted}
          cx="50%"
          cy="50%"
          outerRadius={100}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {formatted.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="text-[#374151] text-xs capitalize">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
