import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Bird, Clock, TrendingUp, RefreshCw, Plus, Cloud, Thermometer, Droplets, Zap, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { useFarmContext } from '../context/FarmContext.jsx';
import { createAssessment, getAssessments, getAssessment, completeMitigation } from '../services/assessmentService.js';
import { getAlerts } from '../services/alertService.js';
import { getImageHistory } from '../services/imageService.js';
import { getFlocks } from '../services/farmService.js';
import { weatherGet } from '../services/api.js';
import MetricCard from '../components/ui/MetricCard.jsx';
import { fmtDateTime } from '../utils/dateFormat.js';
import RiskBadge from '../components/ui/RiskBadge.jsx';
import DualAdvisoryPanel from '../components/assessment/DualAdvisoryPanel.jsx';
import MitigationList from '../components/assessment/MitigationList.jsx';
import PreAssessmentModal from '../components/assessment/PreAssessmentModal.jsx';
import { SkeletonCard } from '../components/ui/LoadingSkeleton.jsx';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isStaleAssessment(assessment) {
  if (!assessment?.assessed_at) return true;
  return Date.now() - new Date(assessment.assessed_at).getTime() > 60 * 60 * 1000;
}

// Merge new mitigations into existing list, deduplicating by action text.
// Also excludes any incoming action whose text appears in completedTexts (a Set
// of action texts the user has already completed, persisted across runs).
function mergeMitigations(existing, incoming, completedTexts = new Set()) {
  const seen = new Set(existing.map((m) => (m.action || m.action_text || '').trim()));
  const toAdd = incoming.filter((m) => {
    const text = (m.action || m.action_text || '').trim();
    return !seen.has(text) && !completedTexts.has(text);
  });
  return [...existing, ...toAdd];
}

// Mirror the backend's mitigation-adherence reduction logic so the score
// updates in real time as the user checks off actions — no reload needed.
const CATEGORY_REDUCTION = {
  vet_alert:   8,
  biosecurity: 6,
  treatment:   5,
  environment: 4,
  nutrition:   3,
};

function scoreToLevel(s) {
  if (s <= 35) return 'low';
  if (s <= 60) return 'medium';
  if (s <= 80) return 'high';
  return 'critical';
}

const severityBorderColor = {
  low: '#2E7D52',
  medium: '#D97706',
  high: '#DC2626',
  critical: '#7C3AED',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { farms, selectedFarm, setSelectedFarm, loading: farmsLoading, refreshFarms } = useFarmContext();
  const [flocks, setFlocks] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [lastDeathReduction, setLastDeathReduction] = useState(null); // { count, pct }
  const [mitigations, setMitigations] = useState([]);
  const [allCompleted, setAllCompleted] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningAssessment, setRunningAssessment] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [showPreModal, setShowPreModal] = useState(false);
  const autoRunLock = useRef(false);
  // Tracks action texts the user has completed this session so they are never
  // re-added by a subsequent assessment run, even after the list clears.
  const completedActionTexts = useRef(new Set());

  // ── When all mitigations are checked → completion animation then clear ──
  useEffect(() => {
    if (mitigations.length > 0 && mitigations.every((m) => m.is_completed)) {
      setAllCompleted(true);
      const t = setTimeout(() => {
        setMitigations([]);
        setAllCompleted(false);
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [mitigations]);

  // ── Weather ──────────────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async (farm) => {
    if (!farm?.latitude || !farm?.longitude) return;
    try {
      const wRes = await weatherGet({ lat: farm.latitude, lon: farm.longitude, state: farm.state });
      setWeather(wRes.data.weather || wRes.data);
      setWeatherUpdatedAt(new Date());
    } catch {
      // weather is optional
    }
  }, []);

  // ── Run assessment (auto or manual) ─────────────────────────────────────────
  const runAssessment = useCallback(async (farm, { silent = false, signals = {} } = {}) => {
    if (!farm) return null;
    if (!silent) setRunningAssessment(true);
    else setAutoRunning(true);
    try {
      const result = await createAssessment({ farm_id: farm.id, ...signals });
      const full = result.assessment || result;
      // Strip any local adjustment state — this is a fresh score from the model
      setAssessment({ ...full, _originalScore: undefined });
      // If deaths were recorded, update the active-bird count and show indicator
      if (result.death_count > 0) {
        const prevSize = (result.updated_flock_size ?? 0) + result.death_count;
        const pct = prevSize > 0 ? ((result.death_count / prevSize) * 100).toFixed(1) : 0;
        setLastDeathReduction({ count: result.death_count, pct });
        refreshFarms();
      }
      // Merge new mitigations, excluding anything already completed this session
      if (full.mitigations?.length) {
        setMitigations((prev) =>
          mergeMitigations(
            prev.filter((m) => !m.is_completed),
            full.mitigations.filter((m) => !m.is_completed),
            completedActionTexts.current
          )
        );
      }
      // Trigger immediate badge refresh if a high/critical risk was detected
      if (full.risk_level === 'high' || full.risk_level === 'critical') {
        window.dispatchEvent(new Event('alerts:refresh'));
      }
      if (!silent) toast.success('Assessment completed!');
      return full;
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.error || err.response?.data?.message || 'Assessment failed');
      return null;
    } finally {
      if (!silent) setRunningAssessment(false);
      else setAutoRunning(false);
    }
  }, []);

  // ── Load dashboard data ──────────────────────────────────────────────────────
  const loadDashboardData = useCallback(async (farm) => {
    if (!farm) return;
    setLoading(true);
    try {
      const [assessmentsRes, imageRes, alertsRes] = await Promise.allSettled([
        // Use farmId (camelCase) — matches backend query param
        getAssessments({ farmId: farm.id, limit: 1 }),
        getImageHistory({ farmId: farm.id, limit: 1 }),
        getAlerts({ limit: 3 }),
      ]);

      let latestAssessment = null;

      if (assessmentsRes.status === 'fulfilled') {
        const data = assessmentsRes.value;
        const list = Array.isArray(data) ? data : data.assessments || [];
        const stub = list[0] || null;

        if (stub?.id) {
          // Fetch the full assessment to get diseases + mitigations
          try {
            const full = await getAssessment(stub.id);
            latestAssessment = full.assessment || full;
          } catch {
            latestAssessment = stub;
          }
        }

        setAssessment(latestAssessment);
        if (latestAssessment?.mitigations?.length) {
          // Seed the completed-text memory from DB so actions done in a previous
          // session also stay excluded when a new assessment runs.
          latestAssessment.mitigations
            .filter((m) => m.is_completed)
            .forEach((m) => {
              const text = (m.action || m.action_text || '').trim();
              if (text) completedActionTexts.current.add(text);
            });
          // Only show pending items
          const pending = latestAssessment.mitigations.filter((m) => !m.is_completed);
          setMitigations(pending);
        }
      }

      if (imageRes.status === 'fulfilled') {
        const data = imageRes.value;
        const list = Array.isArray(data) ? data : data.images || data.history || [];
        setImageAnalysis(list[0] || null);
      }

      if (alertsRes.status === 'fulfilled') {
        const data = alertsRes.value;
        setAlerts(Array.isArray(data) ? data : data.alerts || []);
      }

      await fetchWeather(farm);

      // Auto-run if no assessment exists or last one is older than 1 hour
      if (isStaleAssessment(latestAssessment) && !autoRunLock.current) {
        autoRunLock.current = true;
        runAssessment(farm, { silent: true }).finally(() => {
          autoRunLock.current = false;
        });
      }
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [fetchWeather, runAssessment]);

  // Fetch flocks for the selected farm whenever it changes
  useEffect(() => {
    if (!selectedFarm) return;
    getFlocks(selectedFarm.id)
      .then((data) => setFlocks(data.flocks || []))
      .catch(() => setFlocks([]));
  }, [selectedFarm]);

  useEffect(() => {
    if (!selectedFarm) return;
    setLastDeathReduction(null);
    loadDashboardData(selectedFarm);

    // Re-run assessment automatically every hour
    const assessInterval = setInterval(() => {
      if (!autoRunLock.current) {
        autoRunLock.current = true;
        runAssessment(selectedFarm, { silent: true }).finally(() => {
          autoRunLock.current = false;
        });
      }
    }, 60 * 60 * 1000);

    // Refresh weather every 10 minutes
    const weatherInterval = setInterval(() => fetchWeather(selectedFarm), 10 * 60 * 1000);

    return () => {
      clearInterval(assessInterval);
      clearInterval(weatherInterval);
    };
  }, [selectedFarm, loadDashboardData, fetchWeather, runAssessment]);

  // ── Mark mitigation complete ─────────────────────────────────────────────────
  const handleCompleteMitigation = async (id) => {
    try {
      await completeMitigation(id);

      // Build the updated list synchronously so we can use it for score calc
      const updatedMitigations = mitigations.map((m) => {
        if (m.id === id) {
          const text = (m.action || m.action_text || '').trim();
          if (text) completedActionTexts.current.add(text);
          return { ...m, is_completed: true };
        }
        return m;
      });
      setMitigations(updatedMitigations);

      // Recalculate the risk score in real time — mirrors backend logic exactly.
      // Each completed *category* earns a reduction; cap at 20 pts total.
      const completedCats = new Set(
        updatedMitigations.filter((m) => m.is_completed).map((m) => m.category)
      );
      let reduction = 0;
      for (const cat of completedCats) {
        reduction += CATEGORY_REDUCTION[cat] || 3;
      }
      reduction = Math.min(reduction, 20);

      setAssessment((prev) => {
        if (!prev) return prev;
        // Preserve the original ML score so every re-calc starts from the same base
        const base = prev._originalScore ?? prev.risk_score;
        const adjusted = Math.max(5, base - reduction);
        return {
          ...prev,
          _originalScore: base,
          risk_score:     adjusted,
          risk_level:     scoreToLevel(adjusted),
        };
      });
    } catch {
      toast.error('Failed to update mitigation');
    }
  };

  // ── Manual run — show quick-check modal first ────────────────────────────────
  const handleRunAssessment = () => {
    if (!selectedFarm) return toast.error('Please select a farm first');
    setShowPreModal(true);
  };

  const handleModalConfirm = (signals) => {
    setShowPreModal(false);
    runAssessment(selectedFarm, { signals });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (farmsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (!farms.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#E8F5EE] flex items-center justify-center mb-4">
          <Bird size={32} className="text-[#2E7D52]" />
        </div>
        <h2 className="text-xl font-bold text-[#1A2332] mb-2">No farms yet</h2>
        <p className="text-[#6B7280] mb-6 max-w-sm">
          Create your first farm to start monitoring your flock and running risk assessments.
        </p>
        <Link to="/farms" className="btn-primary">
          <Plus size={16} />
          Create your first farm
        </Link>
      </div>
    );
  }

  const activeBirds = Number(selectedFarm?.total_birds ?? 0);
  const completedCount = mitigations.filter((m) => m.is_completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#1A2332]">
            Welcome back, {user?.full_name?.split(' ')[0] || 'Farmer'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {farms.length > 1 ? (
              <select
                value={selectedFarm?.id || ''}
                onChange={(e) => {
                  const farm = farms.find((f) => String(f.id) === e.target.value);
                  if (farm) setSelectedFarm(farm);
                }}
                className="text-sm text-[#2E7D52] font-medium bg-transparent border-0 border-b border-dashed border-[#2E7D52] focus:outline-none cursor-pointer pr-1 pb-0.5"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-[#6B7280]">
                {selectedFarm ? selectedFarm.name : 'No farm selected'}
              </span>
            )}
            {autoRunning && (
              <span className="inline-flex items-center gap-1 text-[#2E7D52] text-xs font-medium">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Auto-assessing…
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleRunAssessment}
          disabled={runningAssessment || autoRunning || !selectedFarm}
          className="btn-primary sm:self-start"
        >
          {runningAssessment ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running…
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Run New Assessment
            </>
          )}
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          icon={<Activity size={20} className="text-[#2E7D52]" />}
          label="Overall Risk"
          value={assessment ? <RiskBadge level={assessment.risk_level} size="md" /> : '—'}
          subtitle={assessment ? `Score: ${Math.round(assessment.risk_score ?? 0)}` : 'No assessment yet'}
        />
        <MetricCard
          icon={<Bird size={20} className="text-[#2E7D52]" />}
          label="Active Birds"
          value={activeBirds.toLocaleString() || '—'}
          subtitle={
            lastDeathReduction
              ? <span className="text-red-500 font-medium">▼ {lastDeathReduction.count} deaths ({lastDeathReduction.pct}%)</span>
              : `${selectedFarm?.flock_count ?? 0} active flocks`
          }
        />
        <MetricCard
          icon={<Clock size={20} className="text-[#2E7D52]" />}
          label="Last Assessment"
          value={timeAgo(assessment?.assessed_at)}
          subtitle={assessment?.assessed_at ? fmtDateTime(assessment.assessed_at) : ''}
        />
        <MetricCard
          icon={<TrendingUp size={20} className="text-[#2E7D52]" />}
          label="Risk Score"
          value={assessment ? Math.round(assessment.risk_score ?? 0) : '—'}
          subtitle="Out of 100"
          trend={assessment?.risk_score > 70 ? 'up' : assessment?.risk_score < 35 ? 'down' : null}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Advisory Panel + Mitigations */}
        <div className="xl:col-span-2 space-y-6">
          {loading ? (
            <SkeletonCard className="h-80" />
          ) : assessment ? (
            <div className="card">
              <h3 className="text-base font-semibold text-[#1A2332] mb-4">Risk Assessment</h3>
              <DualAdvisoryPanel assessment={assessment} imageAnalysis={imageAnalysis} />
            </div>
          ) : (
            <div className="card text-center py-12">
              <Activity size={32} className="text-[#D1D5DB] mx-auto mb-3" />
              <p className="text-[#9CA3AF] font-medium">
                {autoRunning ? 'Running first assessment…' : 'No assessment data'}
              </p>
              <p className="text-[#D1D5DB] text-sm mt-1">
                {autoRunning ? 'This will only take a moment' : 'Run a new assessment to see results'}
              </p>
            </div>
          )}

          {/* Mitigations */}
          {(mitigations.length > 0 || allCompleted) && (
            <div className="card">
              {allCompleted ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-14 h-14 rounded-full bg-[#E8F5EE] flex items-center justify-center">
                    <CheckCircle2 size={28} className="text-[#2E7D52]" />
                  </div>
                  <p className="text-base font-semibold text-[#2E7D52]">All actions complete!</p>
                  <p className="text-xs text-[#9CA3AF]">Great work keeping your flock safe.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[#1A2332]">Mitigation Actions</h3>
                    <span className="text-xs text-[#9CA3AF]">
                      {completedCount}/{mitigations.length} complete
                    </span>
                  </div>
                  <MitigationList
                    mitigations={mitigations}
                    onComplete={handleCompleteMitigation}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Weather + Alerts */}
        <div className="space-y-4">
          {/* Weather card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cloud size={18} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-[#1A2332]">Current Weather</h3>
              </div>
              {weather?.isMock && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Estimated</span>
              )}
            </div>
            {weather ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 p-2.5 bg-[#F3F4F6] rounded-xl">
                  <Thermometer size={16} className="text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#9CA3AF]">Temperature</p>
                    <p className="text-sm font-semibold text-[#1A2332]">{weather.temperature ?? '—'}°C</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-[#F3F4F6] rounded-xl">
                  <Droplets size={16} className="text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#9CA3AF]">Humidity</p>
                    <p className="text-sm font-semibold text-[#1A2332]">{weather.humidity ?? '—'}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-[#F3F4F6] rounded-xl">
                  <Zap size={16} className="text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#9CA3AF]">Season</p>
                    <p className="text-sm font-semibold text-[#1A2332] capitalize">{weather.season ?? '—'}</p>
                  </div>
                </div>
                {weather.wind_speed != null && (
                  <div className="flex items-center gap-3 p-2.5 bg-[#F3F4F6] rounded-xl">
                    <Cloud size={16} className="text-blue-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#9CA3AF]">Wind Speed</p>
                      <p className="text-sm font-semibold text-[#1A2332]">{weather.wind_speed} m/s</p>
                    </div>
                  </div>
                )}
                {weather.condition && (
                  <p className="text-xs text-[#9CA3AF] text-center capitalize pt-1">{weather.condition}</p>
                )}
                {weatherUpdatedAt && (
                  <p className="text-[10px] text-[#D1D5DB] text-center pt-1">
                    Updated {weatherUpdatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#9CA3AF] text-center py-4">
                {selectedFarm?.latitude ? 'Loading weather…' : 'Add farm coordinates to see weather'}
              </p>
            )}
          </div>

          {/* Recent alerts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1A2332]">Recent Alerts</h3>
              <Link to="/alerts" className="text-xs text-[#2E7D52] hover:underline">View all</Link>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-4">No recent alerts</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border-l-4 text-sm ${alert.is_read ? 'bg-gray-50' : 'bg-blue-50'}`}
                    style={{ borderLeftColor: severityBorderColor[alert.severity] || '#6B7280' }}
                  >
                    <p className="font-medium text-[#1A2332] text-xs">{alert.title}</p>
                    <p className="text-[#9CA3AF] text-[11px] mt-0.5">{timeAgo(alert.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreModal && (
        <PreAssessmentModal
          flocks={flocks}
          onConfirm={handleModalConfirm}
          onCancel={() => setShowPreModal(false)}
        />
      )}
    </div>
  );
}
