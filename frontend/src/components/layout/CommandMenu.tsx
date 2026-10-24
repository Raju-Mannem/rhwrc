import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutDashboard,
  CalendarCheck,
  TrendingUp,
  GitFork,
  Activity,
  BookOpen,
  Calendar,
  X,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'

export function CommandMenu() {
  const { isCommandMenuOpen, setCommandMenuOpen, setSelectedDecisionDate } = useUIStore()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandMenuOpen(!isCommandMenuOpen)
      } else if (e.key === 'Escape') {
        setCommandMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCommandMenuOpen, setCommandMenuOpen])

  if (!isCommandMenuOpen) return null

  const actions = [
    {
      id: 'overview',
      title: 'Go to Overview Dashboard',
      subtitle: 'Executive monthly accuracy & heatmaps',
      icon: LayoutDashboard,
      run: () => navigate('/overview'),
    },
    {
      id: 'decision-day',
      title: 'Go to Decision Review',
      subtitle: 'Inspect settlement intervals for current date',
      icon: CalendarCheck,
      run: () => navigate('/decision/2026-01-02'),
    },
    {
      id: 'evolution',
      title: 'Go to Forecast Evolution',
      subtitle: 'Inspect revision timeline vs decision cutoff',
      icon: TrendingUp,
      run: () => navigate('/forecast-evolution'),
    },
    {
      id: 'provenance',
      title: 'Go to Provenance Explorer',
      subtitle: 'Interactive React Flow lineage graph',
      icon: GitFork,
      run: () => navigate('/decision/2026-01-02/provenance'),
    },
    {
      id: 'data-quality',
      title: 'Go to Data Quality & Ingestion',
      subtitle: 'Freshness, pipeline audits & issue findings',
      icon: Activity,
      run: () => navigate('/data-quality'),
    },
    {
      id: 'methodology',
      title: 'Go to Methodology & Formulas',
      subtitle: 'MAE, RMSE, WAPE, Bias & Elexon rules',
      icon: BookOpen,
      run: () => navigate('/methodology'),
    },
  ]

  // Add sample date jumps in Jan 2026
  const dateJumps = [
    { date: '2026-01-02', label: '2026-01-02 (Complete Day, Stable Forecast)' },
    { date: '2026-01-05', label: '2026-01-05 (Telemetry Gap Scenario)' },
    { date: '2026-01-15', label: '2026-01-15 (Large Overforecast Storm Event)' },
    { date: '2026-01-20', label: '2026-01-20 (Mid-Month Settlement)' },
  ]

  const filteredActions = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.subtitle.toLowerCase().includes(query.toLowerCase())
  )

  const filteredDates = dateJumps.filter((d) =>
    d.label.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (fn: () => void) => {
    fn()
    setCommandMenuOpen(false)
    setQuery('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={() => setCommandMenuOpen(false)}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#12141c] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="flex items-center px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <Search className="h-4 w-4 text-zinc-400 mr-3 shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            placeholder="Type a screen name or date..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Navigation
          </div>
          {filteredActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={() => handleSelect(action.run)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
              >
                <Icon className="h-4 w-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
                <div className="flex-1 truncate">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {action.title}
                  </div>
                  <div className="text-[11px] text-zinc-500">{action.subtitle}</div>
                </div>
              </button>
            )
          })}

          <div className="px-2 pt-3 pb-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Jump to Decision Day
          </div>
          {filteredDates.map((d) => (
            <button
              key={d.date}
              onClick={() =>
                handleSelect(() => {
                  setSelectedDecisionDate(d.date)
                  navigate(`/decision/${d.date}`)
                })
              }
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group font-mono"
            >
              <Calendar className="h-4 w-4 text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
              <span className="text-zinc-800 dark:text-zinc-200">{d.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
