import { create } from 'zustand'
import type { IntervalObservationItem } from '@/types/api'

export type HeatmapMode = 'signed' | 'absolute'
export type ThemeMode = 'light' | 'dark'

interface UIState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void

  selectedMonth: string
  setSelectedMonth: (month: string) => void

  selectedDecisionDate: string
  setSelectedDecisionDate: (date: string) => void

  heatmapMode: HeatmapMode
  setHeatmapMode: (mode: HeatmapMode) => void

  selectedInterval: IntervalObservationItem | null
  setSelectedInterval: (interval: IntervalObservationItem | null) => void

  isIntervalDrawerOpen: boolean
  setIntervalDrawerOpen: (open: boolean) => void

  isCommandMenuOpen: boolean
  setCommandMenuOpen: (open: boolean) => void

  // Strict "No Fake Production Data" policy:
  // When backend is offline or user explicitly wants demo fixtures,
  // isDemoMode is activated and clearly badged in the UI.
  isDemoMode: boolean
  setDemoMode: (enabled: boolean) => void
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light'
  try {
    const saved = localStorage.getItem('gridbricks_theme') as ThemeMode | null
    if (saved === 'dark' || saved === 'light') return saved
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  } catch {
    // ignore local storage / media query failures in test runners
  }
  return 'light'
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('gridbricks_theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    set({ theme })
  },
  toggleTheme: () => {
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('gridbricks_theme', next)
      if (next === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return { theme: next }
    })
  },

  selectedMonth: '2026-01',
  setSelectedMonth: (month) => set({ selectedMonth: month }),

  selectedDecisionDate: '2026-01-02',
  setSelectedDecisionDate: (date) => set({ selectedDecisionDate: date }),

  heatmapMode: 'signed',
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),

  selectedInterval: null,
  setSelectedInterval: (interval) => set({ selectedInterval: interval, isIntervalDrawerOpen: interval !== null }),

  isIntervalDrawerOpen: false,
  setIntervalDrawerOpen: (open) => set({ isIntervalDrawerOpen: open }),

  isCommandMenuOpen: false,
  setCommandMenuOpen: (open) => set({ isCommandMenuOpen: open }),

  isDemoMode: false,
  setDemoMode: (enabled) => set({ isDemoMode: enabled }),
}))
