import { useState, useEffect, useCallback } from 'react'
import { Plus, Building2, Edit2, Trash2, ChevronDown, ChevronUp, Egg, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  getFarms, createFarm, updateFarm, deleteFarm,
  getFlocks, createFlock, updateFlock, deleteFlock
} from '../services/farmService'
import ConfirmModal from '../components/ui/ConfirmModal'
import { useFarmContext } from '../context/FarmContext.jsx'
import { fmtDate } from '../utils/dateFormat'
const NIGERIA_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
]
const HOUSING_TYPES = [
  { value: 'open_sided', label: 'Open-Sided' },
  { value: 'closed', label: 'Closed House' },
  { value: 'battery_cage', label: 'Battery Cage' },
  { value: 'mixed', label: 'Mixed' },
]
const SPECIES = [
  { value: 'broiler', label: 'Broiler' },
  { value: 'layer', label: 'Layer' },
  { value: 'cockerel', label: 'Cockerel' },
  { value: 'turkey', label: 'Turkey' },
  { value: 'duck', label: 'Duck' },
]

const LUCIDE_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

/*
 * All four icons share the same base structure:
 *   - Large circle  → body
 *   - Small circle  → head (slightly overlapping body = neck)
 * Distinguishing features are made large enough to read at w-4 h-4.
 */

/*
 * Hen: ellipse body (wider than circle), TALL 2-bump comb (reaches y=2.5 — visible at 16 px),
 * wing arc inside body so it clearly reads "bird", pointed triangle beak, hanging wattle.
 */
function HenIcon({ className }) {
  return (
    <svg {...LUCIDE_PROPS} className={className}>
      <ellipse cx="10" cy="14" rx="7" ry="5.5" />                              {/* body */}
      <circle  cx="17"  cy="9"  r="2.5" />                                     {/* head */}
      <path d="M15 6.5 Q15.5 2.5 16 6.5 Q16.5 2.5 17 6.5" />                 {/* tall 2-bump comb */}
      <path d="M19.5 8.5 L22 9 L19.5 9.5" />                                  {/* pointed beak */}
      <path d="M17 11.5 Q18 13.5 17 14" />                                     {/* wattle */}
      <path d="M6 12.5 Q10 10.5 14 12.5" />                                    {/* wing arc */}
      <path d="M3 11 Q1 7 2 4" />                                               {/* tail feather */}
      <path d="M8 19.5 L7 22.5 L5 22.5" />                                    {/* left leg */}
      <path d="M12 19.5 L12 22.5 L10 22.5" />                                  {/* right leg */}
    </svg>
  )
}

/* Rooster — 3-bump TALL comb (bumps reach y=3), 3 long sweeping tail feathers, spur */
function CockerelIcon({ className }) {
  return (
    <svg {...LUCIDE_PROPS} className={className}>
      <circle cx="10" cy="14" r="6" />
      <circle cx="16" cy="9"  r="2.5" />
      <path d="M13.5 6.5 Q14 3 14.5 6.5 Q15 3 15.5 6.5 Q16 3 16.5 6.5" />    {/* tall 3-bump comb */}
      <path d="M18.5 8.5 L21 9 L18.5 9.5" />
      <path d="M16 11.5 Q17.5 14 16 14.5" />                                   {/* longer wattle */}
      <path d="M5 9  Q1 5  2 1" />                                              {/* top tail feather */}
      <path d="M5 12 Q0 9  1 5" />                                              {/* mid tail feather */}
      <path d="M5 15 Q1 14 2 11" />                                             {/* low tail feather */}
      <path d="M8 20 L7 23 L5 23" />
      <path d="M12 20 L12 23 L10 23" />
      <path d="M7 21.5 L5.5 20.5" />                                           {/* leg spur */}
    </svg>
  )
}

/* Turkey — fan arc outline + 5 radial feather lines behind body, drooping snood */
function TurkeyIcon({ className }) {
  return (
    <svg {...LUCIDE_PROPS} className={className}>
      <path d="M4 7 Q0 14 4 21" />                                              {/* fan arc outline */}
      <path d="M8 10 L2 6" />                                                   {/* feather line 1 */}
      <path d="M8 12 L1 10" />                                                  {/* feather line 2 */}
      <path d="M8 14 L1 14" />                                                  {/* feather line 3 */}
      <path d="M8 16 L1 18" />                                                  {/* feather line 4 */}
      <path d="M8 18 L2 22" />                                                  {/* feather line 5 */}
      <circle cx="13" cy="14" r="5.5" />                                        {/* body */}
      <circle cx="19.5" cy="8.5" r="2.5" />                                    {/* head */}
      <path d="M22 8 L23.5 7.5 L22 9" />                                       {/* beak */}
      <path d="M21.5 11 Q23 13.5 21.5 14" />                                   {/* drooping snood */}
      <path d="M11 19.5 L10 22.5 L8  22.5" />                                  {/* left leg */}
      <path d="M15 19.5 L15 22.5 L13 22.5" />                                  {/* right leg */}
    </svg>
  )
}

/*
 * Duck: slightly wider/flatter ellipse than hen, NO comb, NO wattle.
 * Bill: flat rectangle — attachment corners (19.5, 7.5) and (19.5, 10.5) sit
 * exactly on the head circle (cx=17.5 cy=9 r=2.5: √((2)²+(1.5)²) = 2.5 ✓).
 * The flat blunt tip vs. hen's pointed triangle beak is the unmistakable difference.
 */
function DuckIcon({ className }) {
  return (
    <svg {...LUCIDE_PROPS} className={className}>
      <ellipse cx="10" cy="14" rx="7.5" ry="5" />                              {/* wider body */}
      <circle  cx="17.5" cy="9"  r="2.5" />                                    {/* head */}
      <path d="M19.5 7.5 L23 7.5 L23 10.5 L19.5 10.5" />                      {/* FLAT bill — rectangle, not triangle */}
      <path d="M6 12.5 Q10 10.5 14 12.5" />                                    {/* wing arc */}
      <path d="M3 11 Q0.5 8 1.5 5.5" />                                        {/* upturned tail */}
      <path d="M8 19 L7 22 L5 22" />                                            {/* left leg */}
      <path d="M12 19 L12 22 L10 22" />                                         {/* right leg */}
    </svg>
  )
}

function SpeciesIcon({ species, className = 'w-4 h-4 text-[#6B7280]' }) {
  if (species === 'layer')   return <Egg       className={className} />
  if (species === 'broiler') return <HenIcon   className={className} />
  if (species === 'cockerel')return <CockerelIcon className={className} />
  if (species === 'turkey')  return <TurkeyIcon className={className} />
  if (species === 'duck')    return <DuckIcon  className={className} />
  return <Egg className={className} />
}

const farmSchema = z.object({
  name: z.string().min(2, 'Farm name is required'),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required'),
  housing_type: z.string().min(1, 'Housing type is required'),
  latitude: z.string().min(1, 'Latitude is required'),
  longitude: z.string().min(1, 'Longitude is required'),
})
const flockSchema = z.object({
  name: z.string().optional(),
  species: z.string().min(1, 'Species is required'),
  flock_size: z.coerce.number().min(1, 'Flock size required'),
  age_weeks: z.coerce.number().min(0, 'Age required'),
  vaccinated: z.boolean().optional(),
  feed_intake_pct: z.coerce.number().min(0).max(100).optional(),
})

function FarmModal({ farm, onClose, onSaved }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(farmSchema),
    defaultValues: farm ? {
      name: farm.name, state: farm.state, city: farm.lga || '',
      housing_type: farm.housing_type,
      latitude: farm.latitude || '', longitude: farm.longitude || '',
    } : {},
  })

  const [locating, setLocating] = useState(false)

  function coordKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey
    const nav = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']
    if (nav.includes(e.key) || ctrl) return
    if (!/^[\d.\-]$/.test(e.key)) e.preventDefault()
  }

  async function getCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setValue('latitude', latitude.toFixed(6))
        setValue('longitude', longitude.toFixed(6))

        try {
          // BigDataCloud returns cleaner state names for Nigeria
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          )
          const data = await res.json()

          // principalSubdivision → e.g. "Lagos State", "FCT Abuja", "Imo State"
          const FCT_ALIASES = ['federal capital territory', 'abuja', 'fct', 'fct abuja']
          const rawState = (data.principalSubdivision || '').trim()
          const normState = rawState.replace(/\s+state$/i, '').trim()
          const matchedState = FCT_ALIASES.includes(normState.toLowerCase())
            ? 'FCT - Abuja'
            : NIGERIA_STATES.find(s => s.toLowerCase() === normState.toLowerCase())
          if (matchedState) setValue('state', matchedState)

          // city → locality → localityInfo fallback
          const city = data.city || data.locality || data.localityInfo?.administrative?.find(a => a.order === 8)?.name || ''
          if (city) setValue('city', city)

          if (accuracy > 5000) {
            toast('Location auto-filled — GPS signal is weak, please verify state and city', {
              icon: '⚠️', duration: 5000,
            })
          } else {
            toast.success('Location detected — please verify state and city')
          }
        } catch {
          toast.success('Coordinates set — please fill state and city manually')
        }

        setLocating(false)
      },
      (err) => {
        toast.error(err.code === 1 ? 'Location permission denied' : 'Unable to retrieve your location')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
    )
  }

  async function onSubmit(data) {
    try {
      const payload = { ...data, lga: data.city }
      if (farm) await updateFarm(farm.id, payload)
      else await createFarm(payload)
      toast.success(farm ? 'Farm updated' : 'Farm created')
      onSaved()
    } catch { toast.error('Failed to save farm') }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold">{farm ? 'Edit Farm' : 'Add Farm'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="form-label">Farm Name *</label>
            <input {...register('name')} className="form-input" placeholder="e.g. Sunshine Farms" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">State *</label>
              <select {...register('state')} className="form-input">
                <option value="">Select state...</option>
                {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
            </div>
            <div>
              <label className="form-label">City *</label>
              <input {...register('city')} className="form-input" placeholder="e.g. Ibadan" />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
            </div>
          </div>
          <div>
            <label className="form-label">Housing Type *</label>
            <select {...register('housing_type')} className="form-input">
              <option value="">Select type...</option>
              {HOUSING_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
            {errors.housing_type && <p className="text-red-500 text-xs mt-1">{errors.housing_type.message}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="form-label mb-0">Location *</label>
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={locating}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2E7D52] hover:bg-[#245F40] px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".4"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
                {locating ? 'Detecting...' : 'Use current location'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label text-xs text-[#6B7280]">Latitude</label>
                <input {...register('latitude')} onKeyDown={coordKeyDown} className="form-input" placeholder="e.g. 6.5244" />
                {errors.latitude && <p className="text-red-500 text-xs mt-1">{errors.latitude.message}</p>}
              </div>
              <div>
                <label className="form-label text-xs text-[#6B7280]">Longitude</label>
                <input {...register('longitude')} onKeyDown={coordKeyDown} className="form-input" placeholder="e.g. 3.3792" />
                {errors.longitude && <p className="text-red-500 text-xs mt-1">{errors.longitude.message}</p>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {isSubmitting ? 'Saving...' : 'Save Farm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function FlockModal({ farmId, flock, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(flockSchema),
    defaultValues: flock ? {
      name: flock.name, species: flock.species,
      flock_size: flock.flock_size, age_weeks: flock.age_weeks,
      vaccinated: flock.vaccinated, feed_intake_pct: flock.feed_intake_pct,
    } : { vaccinated: false, feed_intake_pct: 100 },
  })

  async function onSubmit(data) {
    try {
      if (flock) await updateFlock(flock.id, data)
      else await createFlock(farmId, data)
      toast.success(flock ? 'Flock updated' : 'Flock created')
      onSaved()
    } catch { toast.error('Failed to save flock') }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold">{flock ? 'Edit Flock' : 'Add Flock'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="form-label">Flock Name (optional)</label>
            <input {...register('name')} className="form-input" placeholder="e.g. Batch A - Broilers" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Species *</label>
              <select {...register('species')} className="form-input">
                <option value="">Select...</option>
                {SPECIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {errors.species && <p className="text-red-500 text-xs mt-1">{errors.species.message}</p>}
            </div>
            <div>
              <label className="form-label">Flock Size *</label>
              <input type="number" {...register('flock_size')} className="form-input" min="1" />
              {errors.flock_size && <p className="text-red-500 text-xs mt-1">{errors.flock_size.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Age (weeks) *</label>
              <input type="number" {...register('age_weeks')} className="form-input" min="0" />
              {errors.age_weeks && <p className="text-red-500 text-xs mt-1">{errors.age_weeks.message}</p>}
            </div>
            <div>
              <label className="form-label">Feed Intake %</label>
              <input type="number" {...register('feed_intake_pct')} className="form-input" min="0" max="100" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('vaccinated')} className="rounded" />
            <span className="text-sm font-medium text-[#1A2332]">Vaccinated</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {isSubmitting ? 'Saving...' : 'Save Flock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function FarmManager() {
  const { refreshFarms } = useFarmContext()
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedFarm, setExpandedFarm] = useState(null)
  const [flocks, setFlocks] = useState({})
  const [modal, setModal] = useState(null) // { type: 'farm'|'flock', data: null|obj, farmId }
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await getFarms()
      setFarms(data.farms || [])
    } catch { toast.error('Failed to load farms') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function loadFlocks(farmId) {
    try {
      const data = await getFlocks(farmId)
      setFlocks(prev => ({ ...prev, [farmId]: data.flocks || [] }))
    } catch { toast.error('Failed to load flocks') }
  }

  function toggleFarm(farmId) {
    if (expandedFarm === farmId) { setExpandedFarm(null); return }
    setExpandedFarm(farmId)
    loadFlocks(farmId)
  }

  async function handleDeleteFarm(farm) {
    try {
      await deleteFarm(farm.id)
      toast.success('Farm deleted')
      load()
      refreshFarms()
    } catch { toast.error('Failed to delete farm') }
    setConfirmDelete(null)
  }

  async function handleDeleteFlock(flockId, farmId) {
    try {
      await deleteFlock(flockId)
      toast.success('Flock deleted')
      loadFlocks(farmId)
    } catch { toast.error('Failed to delete flock') }
    setConfirmDelete(null)
  }

  const HOUSING_LABELS = { open_sided: 'Open-Sided', closed: 'Closed', battery_cage: 'Battery Cage', mixed: 'Mixed' }
  const SPECIES_LABELS = { broiler: 'Broiler', layer: 'Layer', cockerel: 'Cockerel', turkey: 'Turkey', duck: 'Duck' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1A2332]">Farm Manager</h1>
        <button onClick={() => setModal({ type: 'farm', data: null })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Farm
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="card h-40 skeleton" />)}
        </div>
      ) : farms.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mb-3" />
          <p className="font-medium text-[#1A2332]">No farms yet</p>
          <p className="text-sm text-[#6B7280] mt-1 mb-4">Add your first farm to get started</p>
          <button onClick={() => setModal({ type: 'farm', data: null })} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Farm
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {farms.map(farm => (
            <div key={farm.id} className="card overflow-hidden p-0">
              {/* Farm header */}
              <div className="bg-[#1A2332] p-5 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{farm.name}</h2>
                    <p className="text-[#94A3B8] text-sm mt-0.5">{farm.state} · {farm.lga}</p>
                    <span className="inline-block mt-2 bg-white/10 text-white text-xs px-2.5 py-1 rounded-full">
                      {HOUSING_LABELS[farm.housing_type] || farm.housing_type}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setModal({ type: 'farm', data: farm })}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ type: 'farm', item: farm })}
                      className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Farm body */}
              <div className="p-5">
                <div className="flex items-center justify-between text-sm text-[#6B7280]">
                  <span>{farm.flock_count || 0} active flock{farm.flock_count !== 1 ? 's' : ''}</span>
                  {farm.last_assessed_at && (
                    <span>Last assessed: {fmtDate(farm.last_assessed_at)}</span>
                  )}
                </div>
                <button
                  onClick={() => toggleFarm(farm.id)}
                  className="mt-3 flex items-center gap-2 text-[#2E7D52] text-sm font-medium hover:text-[#245F40]"
                >
                  {expandedFarm === farm.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {expandedFarm === farm.id ? 'Hide Flocks' : 'Manage Flocks'}
                </button>

                {expandedFarm === farm.id && (
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-[#1A2332] text-sm">Flocks</h3>
                      <button
                        onClick={() => setModal({ type: 'flock', data: null, farmId: farm.id })}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        <Plus className="w-3 h-3" /> Add Flock
                      </button>
                    </div>
                    {!flocks[farm.id] ? (
                      <p className="text-sm text-[#6B7280]">Loading...</p>
                    ) : flocks[farm.id].length === 0 ? (
                      <p className="text-sm text-[#6B7280]">No flocks yet</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {flocks[farm.id].map(flock => (
                          <div key={flock.id} className="border border-[#E5E7EB] rounded-xl p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <SpeciesIcon species={flock.species} />
                                  <span className="font-medium text-sm">{flock.name || 'Unnamed Flock'}</span>
                                </div>
                                <span className="inline-block mt-1 bg-[#E8F5EE] text-[#2E7D52] text-xs px-2 py-0.5 rounded-full capitalize">
                                  {SPECIES_LABELS[flock.species] || flock.species}
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => setModal({ type: 'flock', data: flock, farmId: farm.id })} className="p-1.5 rounded-lg hover:bg-gray-100">
                                  <Edit2 className="w-3.5 h-3.5 text-[#6B7280]" />
                                </button>
                                <button onClick={() => setConfirmDelete({ type: 'flock', item: flock, farmId: farm.id })} className="p-1.5 rounded-lg hover:bg-red-50">
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[#6B7280]">
                              <div><div className="font-semibold text-[#1A2332] text-sm">{flock.flock_size?.toLocaleString()}</div>Birds</div>
                              <div><div className="font-semibold text-[#1A2332] text-sm">{flock.age_weeks}w</div>Age</div>
                              <div><div className="font-semibold text-[#1A2332] text-sm">{Number(flock.current_mortality_rate ?? 0).toFixed(1)}%</div>Mortality</div>
                            </div>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                                <span>Feed intake</span>
                                <span>{Number(flock.feed_intake_pct ?? 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#2E7D52] rounded-full"
                                  style={{ width: `${flock.feed_intake_pct || 0}%` }}
                                />
                              </div>
                            </div>
                            {flock.vaccinated && (
                              <span className="inline-block mt-2 text-xs text-[#2E7D52] bg-[#E8F5EE] px-2 py-0.5 rounded-full">✓ Vaccinated</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'farm' && (
        <FarmModal
          farm={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); refreshFarms() }}
        />
      )}
      {modal?.type === 'flock' && (
        <FlockModal
          farmId={modal.farmId}
          flock={modal.data}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); loadFlocks(modal.farmId); refreshFarms() }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen
          title={`Delete ${confirmDelete.type === 'farm' ? 'Farm' : 'Flock'}`}
          message={
            confirmDelete.type === 'farm'
              ? `Deleting "${confirmDelete.item.name}" will remove all associated flocks and assessment history. This cannot be undone.`
              : `Delete "${confirmDelete.item.name || 'this flock'}"? This action cannot be undone.`
          }
          requireNameMatch={confirmDelete.type === 'farm' ? confirmDelete.item.name : undefined}
          onConfirm={() => {
            if (confirmDelete.type === 'farm') handleDeleteFarm(confirmDelete.item)
            else handleDeleteFlock(confirmDelete.item.id, confirmDelete.farmId)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
