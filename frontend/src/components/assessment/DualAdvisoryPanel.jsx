import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RiskBadge from '../ui/RiskBadge.jsx';
import { Cpu, Eye, AlertTriangle, CheckCircle, Info, ExternalLink, Bot } from 'lucide-react';
import { diseases as encyclopediaDiseases } from '../../utils/encyclopediaData.js';
import { aiNarrative } from '../../services/api.js';

// Map ML disease names → encyclopedia IDs
const DISEASE_SLUG = {
  'Avian Influenza':       'avian-influenza',
  'Newcastle Disease':     'newcastle-disease',
  'Gumboro Disease':       'gumboro-disease',
  "Marek's Disease":       'mareks-disease',
  'Infectious Bronchitis': 'infectious-bronchitis',
  'Fowl Typhoid':          'fowl-typhoid',
  'Coccidiosis':           'coccidiosis',
  'Heat Stress Syndrome':  'heat-stress',
  'Fowl Pox':              'fowl-pox',
};

function DiseaseTooltip({ diseaseName, onNavigate }) {
  const slug = DISEASE_SLUG[diseaseName];
  const entry = slug ? encyclopediaDiseases.find((d) => d.id === slug) : null;
  if (!entry) return null;

  return (
    <div
      className="absolute z-50 left-0 top-full mt-2 w-72 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-4"
      // Prevent the tooltip itself from triggering mouse-leave on the parent
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
        {entry.causative_agent}
      </p>
      <p className="text-sm text-[#374151] leading-relaxed line-clamp-3">
        {entry.overview}
      </p>
      <button
        onClick={onNavigate}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#2E7D52] hover:underline"
      >
        <ExternalLink size={12} />
        View full article in Encyclopedia
      </button>
    </div>
  );
}

function AnimatedRing({ score = 0 }) {
  const circleRef = useRef(null);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    const offset = circumference - (score / 100) * circumference;
    el.style.transition = 'stroke-dashoffset 1.2s ease-in-out';
    el.style.strokeDashoffset = offset;
  }, [score, circumference]);

  const color = score > 70 ? '#DC2626' : score > 35 ? '#D97706' : '#2E7D52';

  return (
    <div className="flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="10"
        />
        <circle
          ref={circleRef}
          cx="64" cy="64" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 64 64)"
        />
        <text x="64" y="60" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
          {score}
        </text>
        <text x="64" y="76" textAnchor="middle" fontSize="10" fill="#9CA3AF">
          / 100
        </text>
      </svg>
    </div>
  );
}

function ProbabilityBar({ probability, color = '#2E7D52' }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(probability * 100), 100);
    return () => clearTimeout(t);
  }, [probability]);

  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SeverityBadge({ level }) {
  const map = {
    0: { label: 'Healthy', cls: 'bg-green-100 text-green-800' },
    1: { label: 'Mild', cls: 'bg-yellow-100 text-yellow-800' },
    2: { label: 'Moderate', cls: 'bg-amber-100 text-amber-800' },
    3: { label: 'Severe', cls: 'bg-red-100 text-red-700' },
  };
  const cfg = map[level] ?? map[0];
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function severityCalloutClass(level) {
  if (level >= 3) return { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-800' };
  if (level >= 2) return { border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-800' };
  if (level === 1) return { border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-800' };
  return { border: 'border-green-300', bg: 'bg-green-50', text: 'text-green-800' };
}

function getAdvisoryBanner(assessment, imageAnalysis) {
  const risk = assessment?.risk_level;
  const disease = imageAnalysis?.predicted_disease;
  const highRisk = risk === 'high' || risk === 'critical';
  const concerningDisease = ['ncd', 'salmonella', 'coccidiosis'].includes(disease);

  if (highRisk && disease === 'ncd') {
    return {
      type: 'urgent',
      icon: AlertTriangle,
      text: 'URGENT: Both risk engines indicate a severe threat. Contact your veterinarian immediately.',
      cls: 'bg-red-50 border-red-300 text-red-800',
    };
  }
  if (highRisk && !concerningDisease) {
    return {
      type: 'warning',
      icon: Info,
      text: 'XGBoost detects elevated environmental risk. Image analysis appears normal. Increase monitoring frequency.',
      cls: 'bg-amber-50 border-amber-300 text-amber-800',
    };
  }
  if (!highRisk && concerningDisease) {
    return {
      type: 'caution',
      icon: Info,
      text: 'Image analysis detected potential disease signs not reflected in environmental data. Conduct a full risk assessment.',
      cls: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    };
  }
  return {
    type: 'ok',
    icon: CheckCircle,
    text: 'Both engines have completed analysis. Review the mitigation actions below.',
    cls: 'bg-green-50 border-green-300 text-green-800',
  };
}

const diseaseColors = { 0: '#2E7D52', 1: '#D97706', 2: '#D97706', 3: '#DC2626' };

export default function DualAdvisoryPanel({ assessment, imageAnalysis }) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const hoverTimer = useRef(null);
  const [aiNarrativeText, setAiNarrativeText] = useState('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  useEffect(() => {
    if (!assessment?.id || !assessment?.farm_id) return;
    setNarrativeLoading(true);
    setAiNarrativeText('');
    aiNarrative({ assessmentId: assessment.id, farmId: assessment.farm_id })
      .then((res) => setAiNarrativeText(res.data?.narrative || ''))
      .catch(() => {}) // silent fallback — hardcoded banner remains
      .finally(() => setNarrativeLoading(false));
  }, [assessment?.id]);

  // Always display highest-probability disease first regardless of stored rank
  const diseases = [...(assessment?.diseases || assessment?.top_diseases || [])].sort(
    (a, b) => (b.probability ?? b.risk_probability ?? 0) - (a.probability ?? a.risk_probability ?? 0)
  );
  const mitigations = assessment?.mitigations || [];
  const riskScore = assessment?.risk_score ?? 0;
  const riskLevel = assessment?.risk_level ?? 'low';

  const envFactors = ['temperature', 'humidity', 'rainfall', 'season'];

  function goToEncyclopedia(diseaseName) {
    const slug = DISEASE_SLUG[diseaseName];
    navigate('/encyclopedia', { state: { diseaseId: slug } });
  }

  function handleMouseEnter(i) {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredIdx(i), 180);
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredIdx(null), 150);
  }

  const banner = getAdvisoryBanner(assessment, imageAnalysis);
  const BannerIcon = banner.icon;

  const cnnDiseaseName = imageAnalysis?.predicted_disease
    ? imageAnalysis.predicted_disease.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const callout = severityCalloutClass(imageAnalysis?.severity_level ?? 0);
  const [confWidth, setConfWidth] = useState(0);
  useEffect(() => {
    if (imageAnalysis?.confidence) {
      const t = setTimeout(() => setConfWidth((imageAnalysis.confidence * 100).toFixed(1)), 100);
      return () => clearTimeout(t);
    }
  }, [imageAnalysis]);

  return (
    <div className="space-y-4">
      {/* Two panels */}
      <div className={`grid gap-4 ${imageAnalysis ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* LEFT: XGBoost */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-[#2E7D52]" />
              <span className="text-sm font-semibold text-[#1A2332]">Environmental Risk Engine</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1A2332] text-white tracking-wide">
              XGBoost
            </span>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <AnimatedRing score={Math.round(riskScore)} />
            <div>
              <p className="text-xs text-[#9CA3AF] mb-1">Overall Risk</p>
              <RiskBadge level={riskLevel} size="md" />
            </div>
          </div>

          {/* Top diseases */}
          {diseases.length > 0 && (
            <div className="space-y-3 mb-4">
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Top Disease Risks</p>
              {diseases.slice(0, 3).map((d, i) => {
                const prob = d.probability ?? d.risk_probability ?? 0;
                const pct = (prob * 100).toFixed(0);
                const concern =
                  prob >= 0.4 ? { label: 'High',    cls: 'bg-red-100 text-red-700'    } :
                  prob >= 0.2 ? { label: 'Moderate', cls: 'bg-amber-100 text-amber-700'} :
                                { label: 'Low',      cls: 'bg-gray-100 text-gray-500'  };
                const name = (d.disease_name || d.name || '').replace(/_/g, ' ');
                const hasEntry = !!DISEASE_SLUG[d.disease_name || d.name || ''];
                return (
                  <div
                    key={i}
                    className="relative"
                    onMouseEnter={() => handleMouseEnter(i)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      className={`flex items-center justify-between mb-1 rounded-lg px-1 -mx-1 transition-colors ${
                        hasEntry ? 'cursor-pointer hover:bg-[#F3F4F6]' : ''
                      }`}
                      onClick={() => hasEntry && goToEncyclopedia(d.disease_name || d.name)}
                    >
                      <span className="text-sm font-medium text-[#1A2332] capitalize py-0.5">
                        {name}
                        {hasEntry && (
                          <ExternalLink size={11} className="inline ml-1 text-[#9CA3AF]" />
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9CA3AF]">{pct}%</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${concern.cls}`}>
                          {concern.label}
                        </span>
                      </div>
                    </div>
                    <ProbabilityBar
                      probability={prob}
                      color={i === 0 ? '#DC2626' : i === 1 ? '#D97706' : '#9CA3AF'}
                    />
                    {hoveredIdx === i && (
                      <DiseaseTooltip
                        diseaseName={d.disease_name || d.name}
                        onNavigate={() => goToEncyclopedia(d.disease_name || d.name)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Env factors */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Environmental Inputs</p>
            <div className="flex flex-wrap gap-1.5">
              {envFactors.map((f) => (
                <span key={f} className="text-xs bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded-full capitalize">
                  {f}:{' '}
                  <span className="font-medium">
                    {assessment?.[f] ?? assessment?.environmental_data?.[f] ?? '—'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: CNN */}
        {imageAnalysis && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-[#1A2332]">Image Analysis Engine</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-700 text-white tracking-wide">
                CNN
              </span>
            </div>

            <h2 className="text-xl font-bold text-[#1A2332] mb-2 capitalize">
              {cnnDiseaseName || 'Unknown'}
            </h2>

            <div className="flex items-center gap-2 mb-4">
              <SeverityBadge level={imageAnalysis.severity_level ?? 0} />
            </div>

            {/* Confidence bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Confidence</p>
                <span className="text-sm font-bold text-[#1A2332]">
                  {((imageAnalysis.confidence ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${confWidth}%`,
                    backgroundColor: diseaseColors[imageAnalysis.severity_level ?? 0],
                  }}
                />
              </div>
            </div>

            {/* Interpretation callout */}
            {imageAnalysis.interpretation && (
              <div className={`border rounded-xl p-3 mb-3 ${callout.bg} ${callout.border}`}>
                <p className={`text-sm ${callout.text}`}>{imageAnalysis.interpretation}</p>
              </div>
            )}

            {imageAnalysis.action && (
              <p className="text-sm text-[#6B7280]">{imageAnalysis.action}</p>
            )}
          </div>
        )}
      </div>

      {/* Advisory Banner — AI narrative when available, hardcoded fallback otherwise */}
      <div className={`flex items-start gap-3 border rounded-xl p-4 ${banner.cls}`}>
        {narrativeLoading ? (
          <Bot size={18} className="flex-shrink-0 mt-0.5 opacity-60" />
        ) : (
          <BannerIcon size={18} className="flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          {narrativeLoading ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-xs opacity-60 ml-1">APRIS AI is analyzing…</span>
            </div>
          ) : (
            <p className="text-sm font-medium">{aiNarrativeText || banner.text}</p>
          )}
          {aiNarrativeText && !narrativeLoading && (
            <p className="text-[10px] opacity-50 mt-1 flex items-center gap-1">
              <Bot size={10} />
              Generated by APRIS AI
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
