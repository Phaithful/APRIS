import { useState, useEffect } from 'react'
import { fmtDate } from '../utils/dateFormat'
import { Navigate } from 'react-router-dom'
import { Shield, Users, Building2, BarChart2, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../services/api'

export default function AdminPanel() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />

  useEffect(() => {
    Promise.all([
      api.get('/api/admin/users'),
      api.get('/api/admin/stats'),
    ]).then(([usersRes, statsRes]) => {
      setUsers(usersRes.data.users || [])
      setStats(statsRes.data)
    }).catch(() => toast.error('Failed to load admin data'))
    .finally(() => setLoading(false))
  }, [])

  async function updateUser(id, field, value) {
    setSaving(prev => ({ ...prev, [id]: true }))
    try {
      const res = await api.patch(`/api/admin/users/${id}`, { [field]: value })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...res.data.user } : u))
      toast.success('User updated')
    } catch {
      toast.error('Failed to update user')
    } finally {
      setSaving(prev => ({ ...prev, [id]: false }))
    }
  }

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total_users, icon: <Users className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
    { label: 'Active Farms', value: stats.total_farms, icon: <Building2 className="w-5 h-5 text-[#2E7D52]" />, bg: 'bg-[#E8F5EE]' },
    { label: 'Risk Assessments', value: stats.total_assessments, icon: <BarChart2 className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50' },
    { label: 'Image Analyses', value: stats.total_image_analyses, icon: <Camera className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50' },
  ] : []

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-[#2E7D52]" />
        <h1 className="text-2xl font-bold text-[#1A2332]">Admin Panel</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {statCards.map(s => (
            <div key={s.label} className="card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                {s.icon}
              </div>
              <div>
                <div className="text-xl font-bold text-[#1A2332]">{s.value?.toLocaleString()}</div>
                <div className="text-xs text-[#6B7280]">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users table */}
      <div className="card overflow-x-auto">
        <h2 className="text-base font-semibold text-[#1A2332] mb-4">User Management</h2>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-10 skeleton rounded-lg" />)}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left">
                <th className="pb-3 font-medium text-[#6B7280]">Name</th>
                <th className="pb-3 font-medium text-[#6B7280]">Email</th>
                <th className="pb-3 font-medium text-[#6B7280]">Role</th>
                <th className="pb-3 font-medium text-[#6B7280]">Active</th>
                <th className="pb-3 font-medium text-[#6B7280]">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="py-3 font-medium">{u.name}</td>
                  <td className="py-3 text-[#6B7280]">{u.email}</td>
                  <td className="py-3">
                    <span className="capitalize text-sm text-[#1A2332]">{u.role}</span>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => updateUser(u.id, 'is_active', !u.is_active)}
                      disabled={saving[u.id]}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${u.is_active ? 'bg-[#2E7D52]' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${u.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="py-3 text-[#6B7280]">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
