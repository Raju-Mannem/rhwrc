import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarCheck,
  GitFork,
  TrendingUp,
  Activity,
  BookOpen,
  Wind,
} from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { selectedDecisionDate } = useUIStore()

  const navItems = [
    {
      to: '/overview',
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'Monthly executive accuracy',
    },
    {
      to: `/decision/${selectedDecisionDate}`,
      label: 'Decision Review',
      icon: CalendarCheck,
      description: '48-interval delivery review',
    },
    {
      to: '/forecast-evolution',
      label: 'Forecast Evolution',
      icon: TrendingUp,
      description: 'Revision history vs cutoff',
    },
    {
      to: `/decision/${selectedDecisionDate}/provenance`,
      label: 'Provenance Graph',
      icon: GitFork,
      description: 'Lineage & selection policy',
    },
    {
      to: '/data-quality',
      label: 'Data Quality',
      icon: Activity,
      description: 'Pipeline health & runs',
    },
    {
      to: '/methodology',
      label: 'Methodology',
      icon: BookOpen,
      description: 'Metric definitions & rules',
    },
  ]

  return (
    <aside className="w-64 border-r border-black/[0.07] dark:border-white/[0.08] bg-white dark:bg-[#12141c] flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <Wind className="h-5 w-5" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            Gridbricks
            <span className="text-[10px] font-normal text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded">
              v1.0
            </span>
          </span>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-none mt-0.5">
            Wind Intelligence Workspace
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          Workspace Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
              <div className="flex-1 truncate">
                <div>{item.label}</div>
              </div>
            </NavLink>
          )
        })}
      </div>

      {/* Subdued Context Footer */}
      <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.08] text-[11px] text-zinc-400 dark:text-zinc-500">
        <div className="flex items-center justify-between">
          <span>Market Dataset</span>
          <span className="font-mono text-zinc-600 dark:text-zinc-400">BMRS / Elexon</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Target Cutoff</span>
          <span className="font-mono text-zinc-600 dark:text-zinc-400">10:00 UK</span>
        </div>
      </div>
    </aside>
  )
}
