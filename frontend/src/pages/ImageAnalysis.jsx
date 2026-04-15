import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Upload, X, ImageIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyseImage, getImageHistory } from '../services/imageService.js';
import { getFlocks } from '../services/farmService.js';
import { useFarmContext } from '../context/FarmContext.jsx';

function SeverityBadge({ level }) {
  const map = {
    0: { label: 'Healthy', cls: 'bg-green-100 text-green-800' },
    1: { label: 'Mild', cls: 'bg-yellow-100 text-yellow-800' },
    2: { label: 'Moderate', cls: 'bg-amber-100 text-amber-800' },
    3: { label: 'Severe', cls: 'bg-red-100 text-red-700' },
  };
  const cfg = map[level] ?? map[0];
  return <span className={`text-sm font-semibold px-3 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function severityCallout(level) {
  if (level >= 3) return { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-800' };
  if (level >= 2) return { border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-800' };
  if (level === 1) return { border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-800' };
  return { border: 'border-green-300', bg: 'bg-green-50', text: 'text-green-800' };
}

import { fmtDate, fmtDateTime } from '../utils/dateFormat';
function formatDate(d) { return fmtDate(d); }

export default function ImageAnalysis() {
  const { farms, selectedFarm, setSelectedFarm } = useFarmContext();
  const [selectedFlockId, setSelectedFlockId] = useState('');
  const [flocks, setFlocks] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [visibleHistory, setVisibleHistory] = useState(5);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (selectedFarm) {
      setSelectedFlockId('');
      setVisibleHistory(5);
      loadHistory(selectedFarm.id);
      getFlocks(selectedFarm.id)
        .then((data) => setFlocks(data.flocks || []))
        .catch(() => setFlocks([]));
    }
  }, [selectedFarm]);

  const loadHistory = async (farmId) => {
    setHistoryLoading(true);
    try {
      const data = await getImageHistory({ farm_id: farmId, limit: 100 });
      setHistory(Array.isArray(data) ? data : data.analyses || data.images || data.history || []);
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  };

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: false,
    maxSize: 10 * 1024 * 1024,
  });

  const handleAnalyse = async () => {
    if (!file) return toast.error('Please upload an image first');
    if (!selectedFarm) return toast.error('Please select a farm');
    if (!selectedFlockId) return toast.error('Please select a flock');

    const formData = new FormData();
    formData.append('image', file);
    formData.append('farm_id', selectedFarm.id);
    if (selectedFlockId) formData.append('flock_id', selectedFlockId);

    setAnalysing(true);
    try {
      const data = await analyseImage(formData);
      const analysis = data.analysis || data.result || data;
      setResult(analysis);
      toast.success('Analysis complete!');
      if (analysis?.predicted_disease && analysis.predicted_disease !== 'healthy') {
        window.dispatchEvent(new Event('alerts:refresh'));
      }
      setVisibleHistory(5);
      loadHistory(selectedFarm.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Image analysis failed');
    } finally {
      setAnalysing(false);
    }
  };

  const clearImage = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const callout = result ? severityCallout(result.severity_level ?? 0) : null;
  const diseaseName = result?.predicted_disease
    ? result.predicted_disease.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className="rounded-2xl p-5 sm:p-6 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, #1A2332 0%, #243447 100%)' }}
      >
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
          <Camera size={24} color="white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Image Analysis</h2>
          <p className="text-[#94A3B8] text-sm">Upload a flock photo for AI-powered disease detection using CNN</p>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Upload */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold text-[#1A2332] mb-4">Upload Image</h3>

            {/* Farm / flock selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="form-label">Farm</label>
                <select
                  className="form-input"
                  value={selectedFarm?.id || ''}
                  onChange={(e) => {
                    const farm = farms.find((f) => String(f.id) === e.target.value);
                    if (farm) setSelectedFarm(farm);
                  }}
                >
                  <option value="">Select farm</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Flock *</label>
                <select
                  className="form-input"
                  value={selectedFlockId}
                  onChange={(e) => setSelectedFlockId(e.target.value)}
                >
                  <option value="">Select flock...</option>
                  {flocks.map((fl) => (
                    <option key={fl.id} value={fl.id}>{fl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dropzone */}
            {!preview ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-[#2E7D52] bg-[#E8F5EE]'
                    : 'border-[#E5E7EB] hover:border-[#2E7D52] hover:bg-[#F9FAFB]'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center">
                    <Upload size={24} className="text-[#9CA3AF]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#1A2332]">
                      {isDragActive ? 'Drop the image here' : 'Drag & drop an image here'}
                    </p>
                    <p className="text-sm text-[#9CA3AF] mt-1">or click to browse · JPG, PNG, WEBP · max 10MB</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-[#E5E7EB]">
                <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                  {file?.name}
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyse}
              disabled={!file || analysing}
              className="btn-primary w-full justify-center mt-4"
            >
              {analysing ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing image…
                </>
              ) : (
                <>
                  <Camera size={16} />
                  Analyse Image
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          <div className="card h-full">
            <h3 className="text-sm font-semibold text-[#1A2332] mb-4">Analysis Result</h3>
            {!result ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon size={40} className="text-[#D1D5DB] mb-3" />
                <p className="text-[#9CA3AF] font-medium text-sm">No analysis yet</p>
                <p className="text-[#D1D5DB] text-xs mt-1">Upload an image and click Analyse</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#1A2332] capitalize mb-2">{diseaseName}</h2>
                  <SeverityBadge level={result.severity_level ?? 0} />
                </div>

                {/* Confidence */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Confidence</p>
                    <span className="text-sm font-bold text-[#1A2332]">
                      {((result.confidence ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2E7D52] transition-all duration-700"
                      style={{ width: `${(result.confidence ?? 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Interpretation callout */}
                {result.interpretation && (
                  <div className={`border rounded-xl p-3 ${callout.bg} ${callout.border}`}>
                    <p className={`text-sm ${callout.text}`}>{result.interpretation}</p>
                  </div>
                )}

                {result.action && (
                  <p className="text-sm text-[#6B7280]">{result.action}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="card">
        <h3 className="text-base font-semibold text-[#1A2332] mb-4">Analysis History</h3>
        {historyLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-6">No history for this farm</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 px-3 text-[#6B7280] font-medium text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left py-2 px-3 text-[#6B7280] font-medium text-xs uppercase tracking-wider">Condition</th>
                  <th className="text-left py-2 px-3 text-[#6B7280] font-medium text-xs uppercase tracking-wider">Confidence</th>
                  <th className="text-left py-2 px-3 text-[#6B7280] font-medium text-xs uppercase tracking-wider">Farm</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, visibleHistory).map((h, i) => (
                  <tr key={h.id || i} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                    <td className="py-2.5 px-3 text-[#6B7280]">{formatDate(h.analysed_at || h.created_at)}</td>
                    <td className="py-2.5 px-3">
                      <span className="capitalize text-[#1A2332] font-medium">
                        {(h.predicted_class || h.predicted_disease || h.condition || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-full rounded-full bg-[#2E7D52]"
                            style={{ width: `${((h.confidence ?? 0) * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="text-[#6B7280] text-xs">{((h.confidence ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#6B7280]">{h.farm_name || selectedFarm?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleHistory < history.length && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setVisibleHistory(v => v + 5)}
                  className="btn-secondary text-sm"
                >
                  Show More
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
