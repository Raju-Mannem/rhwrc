import { AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/Button'

export function DemoBadge() {
  const { isDemoMode, setDemoMode } = useUIStore()

  if (!isDemoMode) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Wifi className="h-3 w-3" />
        <span>Live API</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shadow-xs">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span>
        <strong className="font-semibold">DEMO FIXTURE MODE</strong> — Backend offline or demo enabled
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 text-[10px] text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
        onClick={() => {
          setDemoMode(false)
          window.location.reload()
        }}
      >
        <WifiOff className="h-3 w-3 mr-1" />
        Try Live API
      </Button>
    </div>
  )
}
