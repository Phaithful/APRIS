import { useState, useEffect, useCallback } from 'react'
import { Bell, AlertTriangle, CheckCircle2, Activity, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAlerts, dismissAlert } from '../services/alertService'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'high_risk', label: 'High Risk' },
  { key: 'critical_risk', label: 'Critical' },
  { key: 'image_disease', label: 'Image Analysis' },
  { key: 'mortality', label: 'Mortality' },
]

const SEVERITY_STYLES = {
  critical: { border: 'border-l-red-600', bg: '', dot: 'bg-red-600', icon: <AlertTriangle className="w-4 h-4 text-red-600" /> },
  high:     { border: 'border-l-orange-500', bg: '', dot: 'bg-orange-500', icon: <AlertTriangle className="w-4 h-4 text-orange-500" /> },
  warning:  { border: 'border-l-amber-500', bg: '', dot: 'bg-amber-500', icon: <Activity className="w-4 h-4 text-amber-500" /> },
  info:     { border: 'border-l-blue-500', bg: '', dot: 'bg-blue-400', icon: <Bell className="w-4 h-4 text-blue-500" /> },
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (activeTab === 'unread') params.unread_only = 'true'
      else if (activeTab !== 'all') params.type = activeTab

      const data = await getAlerts(params)
      setAlerts(data.alerts || [])
      setUnreadCount(data.unread_count || 0)
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  async function handleDismiss(id) {
    try {
      await dismissAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      toast.error('Failed to dismiss alert')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-[#1A2332]">Alerts</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setLoading(true) }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-[#2E7D52] text-white'
                : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.key === 'all' && alerts.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-[#6B7280]'}`}>
                {alerts.length}
              </span>
            )}
            {tab.key === 'unread' && unreadCount > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'unread' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="card h-20 skeleton" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="w-12 h-12 text-[#2E7D52] mb-3" />
          <p className="font-medium text-[#1A2332]">All clear</p>
          <p className="text-sm text-[#6B7280] mt-1">No alerts to display</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
            const isUnread = !alert.is_read
            return (
              <div
                key={alert.id}
                className={`card border-l-4 ${style.border} ${isUnread ? 'bg-blue-50/40' : ''} transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{style.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#1A2332] text-sm">{alert.title}</span>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-[#6B7280] mt-0.5 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#9CA3AF]">
                        {alert.farm_name && <span>{alert.farm_name}</span>}
                        {alert.flock_name && <span>· {alert.flock_name}</span>}
                        <span>· {timeAgo(alert.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-[#9CA3AF] hover:text-[#6B7280]"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
