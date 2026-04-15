import { useState, useEffect } from 'react'
import { BarChart2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { getRiskTrend, getMortalityTrend, getDiseaseFrequency, getSummary } from '../services/analyticsService'
import { fmtDate } from '../utils/dateFormat'
import { getAssessments } from '../services/assessmentService'
import { useFarmContext } from '../context/FarmContext.jsx'
import RiskTrendChart from '../components/charts/RiskTrendChart'
import MortalityChart from '../components/charts/MortalityChart'
import DiseaseFreqChart from '../components/charts/DiseaseFreqChart'
import EnvironmentalChart from '../components/charts/EnvironmentalChart'
import RiskBadge from '../components/ui/RiskBadge'
import { SkeletonCard } from '../components/ui/LoadingSkeleton'

const DAYS_OPTIONS = [7, 14, 30, 90]

export default function Analytics() {
  const { farms, selectedFarm, setSelectedFarm } = useFarmContext()
  const [days, setDays] = useState(30)
  const [riskTrend, setRiskTrend] = useState([])
  const [mortality, setMortality] = useState([])
  const [diseaseFreq, setDiseaseFreq] = useState([])
  const [environmental, setEnvironmental] = useState([])
  const [summary, setSummary] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [visibleCount, setVisibleCount] = useState(10)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedFarm) return
    setLoading(true)
    const farmId = selectedFarm.id
    Promise.all([
      getRiskTrend(farmId, days).catch(() => ({ data: [] })),
      getMortalityTrend({ farmId, days }).catch(() => ({ data: [] })),
      getDiseaseFrequency(farmId, days).catch(() => ({ data: [] })),
      getSummary(farmId).catch(() => null),
      getAssessments({ farmId, limit: 200 }),
    ]).then(([rt, mt, df, sum, assess]) => {
      setRiskTrend(rt.data || [])
      setMortality(mt.data || [])
      setDiseaseFreq(df.data || [])
      setSummary(sum)
      setVisibleCount(10)
      setAssessments(assess.assessments || [])
      // Build environmental data from risk trend (temperature/humidity stored per assessment)
      setEnvironmental((rt.data || []).map(d => ({
        date: d.date,
        temperature: d.temperature != null ? parseFloat(d.temperature) : null,
        humidity: d.humidity != null ? parseFloat(d.humidity) : null,
      })).filter(d => d.temperature !== null || d.humidity !== null))
    }).catch(err => toast.error('Failed to load analytics')).finally(() => setLoading(false))
  }, [selectedFarm, days])

  function exportCSV() {
    if (!assessments.length) return
    const escape = v => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const headers = ['Date', 'Farm', 'Flock', 'Risk Level', 'Risk Score', 'Temperature (°C)', 'Humidity (%)', 'Season', 'Region', 'Nearby Outbreak', 'Wild Bird Proximity']
    const rows = assessments.map(a => [
      fmtDate(a.assessed_at),
      a.farm_name || '',
      a.flock_name || '',
      a.risk_level || '',
      a.risk_score ?? '',
      a.temperature ?? '',
      a.humidity ?? '',
      a.season || '',
      a.region || '',
      a.nearby_outbreak != null ? (a.nearby_outbreak ? 'Yes' : 'No') : '',
      a.wild_bird_proximity != null ? (a.wild_bird_proximity ? 'Yes' : 'No') : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'apris-assessments.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-[#1A2332]">Analytics & Trends</h1>
        <button onClick={exportCSV} className="btn-secondary text-sm sm:self-start">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[#6B7280]">Farm:</label>
          <select
            value={selectedFarm?.id || ''}
            onChange={e => setSelectedFarm(farms.find(f => f.id === e.target.value) || null)}
            className="form-input w-auto h-9 text-sm"
          >
            <option value="">Select farm...</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                days === d ? 'bg-[#2E7D52] text-white' : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >{d}d</button>
          ))}
        </div>
      </div>

      {!selectedFarm ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <BarChart2 className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-[#6B7280]">Select a farm to view analytics</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <SkeletonCard className="h-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-48" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { label: 'Total Assessments', value: summary.total_assessments },
                { label: 'Active Flocks', value: summary.active_flocks },
                { label: 'Avg Risk Score', value: summary.average_risk_score },
                { label: 'Last Risk Level', value: summary.last_assessment?.risk_level || '—' },
              ].map(s => (
                <div key={s.label} className="card text-center">
                  <div className="text-2xl font-bold text-[#1A2332]">{s.value}</div>
                  <div className="text-xs text-[#6B7280] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Risk Trend */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#1A2332] mb-4">Risk Score Trend</h2>
            <RiskTrendChart data={riskTrend} />
          </div>

          {/* Disease + Mortality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="text-base font-semibold text-[#1A2332] mb-4">Top Diseases Flagged</h2>
              <DiseaseFreqChart data={diseaseFreq} />
            </div>
            <div className="card">
              <h2 className="text-base font-semibold text-[#1A2332] mb-4">Mortality Rate Trend</h2>
              <MortalityChart data={mortality} />
            </div>
          </div>

          {/* Environmental */}
          <div className="card">
            <h2 className="text-base font-semibold text-[#1A2332] mb-4">Environmental Conditions</h2>
            <EnvironmentalChart data={environmental} />
          </div>

          {/* Assessment History Table */}
          <div className="card overflow-x-auto">
            <h2 className="text-base font-semibold text-[#1A2332] mb-4">Assessment History</h2>
            {assessments.length === 0 ? (
              <p className="text-[#6B7280] text-sm text-center py-8">No assessments yet</p>
            ) : (
              <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#6B7280] border-b border-[#E5E7EB]">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Farm</th>
                    <th className="pb-2 font-medium">Flock</th>
                    <th className="pb-2 font-medium">Risk Level</th>
                    <th className="pb-2 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.slice(0, visibleCount).map(a => (
                    <tr key={a.id} className="border-b border-[#E5E7EB] last:border-0">
                      <td className="py-2.5 text-[#6B7280]">{fmtDate(a.assessed_at)}</td>
                      <td className="py-2.5">{a.farm_name}</td>
                      <td className="py-2.5 text-[#6B7280]">{a.flock_name || '—'}</td>
                      <td className="py-2.5"><RiskBadge level={a.risk_level} size="sm" /></td>
                      <td className="py-2.5 font-semibold">{a.risk_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleCount < assessments.length && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setVisibleCount(c => c + 10)}
                    className="btn-secondary text-sm"
                  >
                    Show More
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
