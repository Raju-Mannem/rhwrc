import { Moon, Sun, Search, Clock, Calendar } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { DemoBadge } from '@/components/feedback/DemoBadge'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function Topbar() {
  const { theme, toggleTheme, setCommandMenuOpen, selectedMonth } = useUIStore()

  return (
    <header className="h-16 border-b border-black/[0.07] dark:border-white/[0.08] bg-white/80 dark:bg-[#12141c]/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Operational Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Period:</span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
            {selectedMonth} (Day-Ahead Decisions)
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

        <Badge variant="neutral" size="sm" className="hidden md:inline-flex gap-1.5 py-1">
          <Clock className="h-3 w-3 text-zinc-500" />
          <span>Cutoff: 10:00 Europe/London</span>
        </Badge>
      </div>

      {/* Right: Actions, Search, Live status, Theme */}
      <div className="flex items-center gap-3">
        {/* Quick Command Trigger */}
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs gap-2 h-8 px-2.5"
          onClick={() => setCommandMenuOpen(true)}
          title="Open Command Palette (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search or jump to date...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            ⌘K
          </kbd>
        </Button>

        {/* Live / Demo Mode Indicator */}
        <DemoBadge />

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  )
}
