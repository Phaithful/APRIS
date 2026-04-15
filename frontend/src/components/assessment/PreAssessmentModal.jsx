import { useState, useMemo } from 'react';
import { X, AlertTriangle, Bird, Utensils, Feather } from 'lucide-react';

const FEED_OPTIONS = [
  { value: 100, label: 'Normal: eating as usual'           },
  { value: 75,  label: 'Reduced: noticeably less than normal' },
  { value: 50,  label: 'Poor: eating very little'          },
  { value: 10,  label: 'Barely eating'                     },
];

export default function PreAssessmentModal({ flocks = [], onConfirm, onCancel }) {
  const [selectedFlockId, setSelectedFlockId] = useState(flocks[0]?.id ?? '');
  const [feedIntake,       setFeedIntake]      = useState(100);
  const [deathCount,       setDeathCount]      = useState('');
  const [nearbyOutbreak,   setNearbyOutbreak]  = useState(0);
  const [wildBirds,        setWildBirds]       = useState(0);

  const selectedFlock = useMemo(
    () => flocks.find((f) => f.id === selectedFlockId) || flocks[0],
    [flocks, selectedFlockId]
  );

  const flockSize = parseInt(selectedFlock?.flock_size) || 0;
  const deaths    = parseInt(deathCount) || 0;

  // mortality rate = (deaths in last 7 days / flock size) × 100, capped at 100
  const mortalityRate = flockSize > 0
    ? Math.min(100, parseFloat(((deaths / flockSize) * 100).toFixed(2)))
    : 0;

  function handleRun() {
    onConfirm({
      flock_id:            selectedFlock?.id,
      feed_intake_pct:     feedIntake,
      mortality_rate_pct:  mortalityRate,
      death_count:         deaths,
      nearby_outbreak:     nearbyOutbreak,
      wild_bird_proximity: wildBirds,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-base font-bold text-[#1A2332]">Quick Flock Check</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Answer before running: these signals directly affect the risk score
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#9CA3AF]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">

          {/* Flock selector */}
          {flocks.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-[#1A2332] block mb-2">
                Which flock are you assessing?
              </label>
              <select
                value={selectedFlockId}
                onChange={(e) => setSelectedFlockId(e.target.value)}
                className="w-full form-input"
              >
                {flocks.map((fl) => (
                  <option key={fl.id} value={fl.id}>
                    {fl.name} ({fl.flock_size?.toLocaleString()} birds, {fl.species})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Feed intake */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#1A2332] mb-2">
              <Utensils size={15} className="text-[#2E7D52]" />
              How are birds eating right now?
            </label>
            <div className="space-y-1.5">
              {FEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFeedIntake(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    feedIntake === opt.value
                      ? 'border-[#2E7D52] bg-[#E8F5EE] text-[#2E7D52] font-medium'
                      : 'border-[#E5E7EB] text-[#374151] hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mortality: number input */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#1A2332] mb-2">
              <Bird size={15} className="text-[#DC2626]" />
              How many birds died in the last 7 days?
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max={flockSize || undefined}
                value={deathCount}
                onChange={(e) => setDeathCount(e.target.value)}
                placeholder="0"
                className="form-input w-36"
              />
              {flockSize > 0 && deaths > 0 && (
                <span className={`text-sm font-semibold ${
                  mortalityRate >= 7  ? 'text-red-600'   :
                  mortalityRate >= 3  ? 'text-amber-600' :
                                        'text-[#6B7280]'
                }`}>
                  = {mortalityRate}% of flock
                </span>
              )}
            </div>
            {flockSize > 0 && (
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                Out of {flockSize.toLocaleString()} birds in this flock
              </p>
            )}
          </div>

          {/* Outbreak + Wild birds */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-[#1A2332] mb-2">
                <AlertTriangle size={14} className="text-amber-500" />
                Nearby outbreak?
              </label>
              <div className="flex gap-2">
                {[{ v: 0, l: 'No' }, { v: 1, l: 'Yes' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setNearbyOutbreak(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      nearbyOutbreak === v
                        ? v === 1
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-[#2E7D52] bg-[#E8F5EE] text-[#2E7D52]'
                        : 'border-[#E5E7EB] text-[#374151] hover:bg-gray-50'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#9CA3AF] mt-1">Disease report within 30 km</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-[#1A2332] mb-2">
                <Feather size={14} className="text-blue-500" />
                Wild birds on farm?
              </label>
              <div className="flex gap-2">
                {[{ v: 0, l: 'No' }, { v: 1, l: 'Yes' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setWildBirds(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      wildBirds === v
                        ? v === 1
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-[#2E7D52] bg-[#E8F5EE] text-[#2E7D52]'
                        : 'border-[#E5E7EB] text-[#374151] hover:bg-gray-50'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#9CA3AF] mt-1">Sparrows, pigeons, migratory birds</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            className="flex-1 py-2.5 rounded-xl bg-[#2E7D52] text-white text-sm font-semibold hover:bg-[#245f3f] transition-colors"
          >
            Run Assessment
          </button>
        </div>
      </div>
    </div>
  );
}
