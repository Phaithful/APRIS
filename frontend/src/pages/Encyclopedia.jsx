import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, BookOpen, ChevronLeft, ChevronRight, Bot, Send } from 'lucide-react'
import { diseases } from '../utils/encyclopediaData'
import { aiEncyclopedia } from '../services/api.js'

export default function Encyclopedia() {
  const location = useLocation()
  const [selected, setSelected] = useState(diseases[0])
  const [search, setSearch] = useState('')
  // Mobile: 'list' shows the disease list, 'detail' shows the article
  const [mobileView, setMobileView] = useState('list')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)

  // Reset AI panel when disease changes
  useEffect(() => {
    setAiAnswer('')
    setAiQuestion('')
  }, [selected?.id])

  // If navigated here from the Dashboard with a disease pre-selected, open it
  useEffect(() => {
    const id = location.state?.diseaseId
    if (id) {
      const match = diseases.find((d) => d.id === id)
      if (match) {
        setSelected(match)
        setMobileView('detail')
      }
    }
  }, [location.state])

  const filtered = diseases.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAskAI(questionOverride) {
    const q = (questionOverride || aiQuestion).trim()
    if (!q) return
    setAiLoading(true)
    setAiAnswer('')
    if (!questionOverride) setAiQuestion(q)
    try {
      const res = await aiEncyclopedia({ question: q, diseaseName: selected?.name })
      setAiAnswer(res.data?.answer || '')
    } catch {
      setAiAnswer('Sorry, the AI could not answer that question right now. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  function selectDisease(disease) {
    setSelected(disease)
    setMobileView('detail')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A2332] mb-6">Disease Encyclopedia</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Disease list panel */}
        <div className={`md:block md:w-64 md:flex-shrink-0 ${mobileView === 'list' ? 'block' : 'hidden'}`}>
          <div className="card p-0 overflow-hidden md:sticky md:top-24">
            <div className="p-3 border-b border-[#E5E7EB]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search diseases..."
                  className="w-full pl-9 pr-3 h-9 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#2E7D52] focus:ring-1 focus:ring-[#2E7D52]/20"
                />
              </div>
            </div>
            <nav className="max-h-[60vh] md:max-h-[calc(100vh-280px)] overflow-y-auto">
              {filtered.map(disease => (
                <button
                  key={disease.id}
                  onClick={() => selectDisease(disease)}
                  className={`w-full text-left px-4 py-3 text-sm border-l-4 transition-all flex items-center justify-between ${
                    selected?.id === disease.id
                      ? 'border-l-[#2E7D52] bg-[#E8F5EE] text-[#2E7D52] font-semibold'
                      : 'border-l-transparent text-[#374151] hover:bg-gray-50 font-normal'
                  }`}
                >
                  <span>{disease.name}</span>
                  <ChevronRight className="w-4 h-4 opacity-40 md:hidden flex-shrink-0" />
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-sm text-[#6B7280] text-center">No matches found</p>
              )}
            </nav>
          </div>
        </div>

        {/* Article panel */}
        <div className={`md:block flex-1 min-w-0 ${mobileView === 'detail' ? 'block' : 'hidden'}`}>
          {/* Back button — mobile only */}
          <button
            onClick={() => setMobileView('list')}
            className="md:hidden flex items-center gap-1.5 text-sm font-medium text-[#2E7D52] mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            All diseases
          </button>

          {selected ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="card">
                <h1 className="text-2xl font-bold text-[#1A2332]">{selected.name}</h1>
                <p className="text-[#6B7280] text-sm mt-1">
                  <span className="font-medium">Causative agent:</span> {selected.causative_agent}
                </p>
                <p className="text-[#6B7280] text-sm mt-0.5">
                  <span className="font-medium">Affected species:</span> {selected.affected_species}
                </p>
              </div>

              {/* Overview */}
              <div className="card">
                <h2 className="text-base font-semibold text-[#1A2332] mb-2">Overview</h2>
                <p className="text-sm text-[#374151] leading-relaxed">{selected.overview}</p>
              </div>

              {/* Key Signs */}
              <div className="card">
                <h2 className="text-base font-semibold text-[#1A2332] mb-3">Key Clinical Signs</h2>
                <ul className="space-y-1.5">
                  {selected.key_signs.map((sign, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] mt-2 flex-shrink-0" />
                      {sign}
                    </li>
                  ))}
                </ul>
              </div>

              {/* At Risk Conditions */}
              <div className="card">
                <h2 className="text-base font-semibold text-[#1A2332] mb-3">At-Risk Conditions</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-left">
                        <th className="pb-2 font-medium text-[#6B7280]">Risk Factor</th>
                        <th className="pb-2 font-medium text-[#6B7280]">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.at_risk_conditions.map((c, i) => (
                        <tr key={i} className="border-b border-[#E5E7EB] last:border-0">
                          <td className="py-2 text-[#374151]">{c.factor}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                              c.risk_level === 'Critical' ? 'bg-red-100 text-red-700' :
                              c.risk_level === 'High' ? 'bg-orange-100 text-orange-700' :
                              c.risk_level === 'Medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {c.risk_level}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Prevention */}
                <div className="card">
                  <h2 className="text-base font-semibold text-[#1A2332] mb-3">Prevention Measures</h2>
                  <ol className="space-y-1.5 list-none">
                    {selected.prevention.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                        <span className="w-5 h-5 rounded-full bg-[#E8F5EE] text-[#2E7D52] text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Treatment */}
                <div className="card">
                  <h2 className="text-base font-semibold text-[#1A2332] mb-3">Treatment Options</h2>
                  <ul className="space-y-1.5">
                    {selected.treatment.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D52] mt-2 flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Nigerian Relevance */}
              <div className="card border-l-4 border-l-[#2E7D52] bg-[#E8F5EE]/40">
                <h2 className="text-base font-semibold text-[#2E7D52] mb-2">Nigerian Relevance</h2>
                <p className="text-sm text-[#374151] leading-relaxed">{selected.nigerian_relevance}</p>
              </div>

              {/* Vet Alert */}
              <div className="card border-l-4 border-l-[#DC2626] bg-red-50">
                <h2 className="text-base font-semibold text-[#DC2626] mb-2">⚠ When to Call Your Vet</h2>
                <p className="text-sm text-[#374151] leading-relaxed">{selected.vet_alert}</p>
              </div>

              {/* APRIS AI Q&A Panel */}
              <div className="card border-t-4 border-t-[#2E7D52]">
                <button
                  onClick={() => setAiPanelOpen(!aiPanelOpen)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Bot size={18} className="text-[#2E7D52]" />
                    <h2 className="text-base font-semibold text-[#1A2332]">
                      Ask APRIS AI about {selected.name}
                    </h2>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-[#9CA3AF] transition-transform duration-200 ${aiPanelOpen ? 'rotate-90' : ''}`}
                  />
                </button>

                {aiPanelOpen && (
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAskAI() }}
                        placeholder={`Ask about ${selected.name}…`}
                        className="flex-1 h-10 px-3 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#2E7D52] focus:ring-1 focus:ring-[#2E7D52]/20"
                      />
                      <button
                        onClick={() => handleAskAI()}
                        disabled={!aiQuestion.trim() || aiLoading}
                        className="w-10 h-10 rounded-lg bg-[#2E7D52] text-white flex items-center justify-center hover:bg-[#245F40] disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] transition-colors flex-shrink-0"
                      >
                        {aiLoading
                          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <Send size={15} />
                        }
                      </button>
                    </div>

                    {/* Quick question chips */}
                    {!aiAnswer && !aiLoading && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          `How do I prevent ${selected.name}?`,
                          `What are the early signs of ${selected.name}?`,
                          `Is ${selected.name} common in Nigeria?`,
                        ].map((q) => (
                          <button
                            key={q}
                            onClick={() => { setAiQuestion(q); handleAskAI(q) }}
                            className="text-xs px-3 py-1.5 rounded-full border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#2E7D52] hover:text-[#2E7D52] transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Answer */}
                    {aiAnswer && (
                      <div className="mt-3 p-4 bg-[#F0FAF4] border border-[#BBE5CC] rounded-xl">
                        <p className="text-sm text-[#1A2332] leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-2 flex items-center gap-1">
                          <Bot size={10} />
                          APRIS AI — advisory only. Consult a vet for clinical decisions.
                        </p>
                        <button
                          onClick={() => { setAiAnswer(''); setAiQuestion('') }}
                          className="mt-2 text-xs text-[#2E7D52] hover:underline"
                        >
                          Ask another question
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-24">
              <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-[#6B7280]">Select a disease to read about it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
