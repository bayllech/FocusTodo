
import { create } from 'zustand'

import { fetchSettings, recordWindowState, saveSettings } from '../services/api'
import type { UserSettings, WindowGeometry } from '../types'

const fallbackSettings: UserSettings = {
  theme: 'mac',
  followSystemTheme: true,
  alwaysOnTop: true,
  snapEdge: true,
  floatingOpacity: 0.95, // 默认95%透明度
  showCompletedInFloating: false, // 默认不显示已完成任务
  hotkeys: {},
  windowState: {
    main: {},
    floating: {},
  },
}

interface SettingsState {
  settings: UserSettings
  loading: boolean
  error?: string
  loadSettings: () => Promise<void>
  saveSettings: (settings: UserSettings) => Promise<UserSettings>
  updateFloatingOpacity: (opacity: number) => Promise<void>
  toggleShowCompleted: () => Promise<void>
  toggleAlwaysOnTop: (next?: boolean) => Promise<void>
  persistWindowGeometry: (label: 'main' | 'floating', geometry: WindowGeometry) => Promise<void>
  clearError: () => void
}

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const mergeGeometry = (
  prev: WindowGeometry,
  next: WindowGeometry,
): WindowGeometry => ({
  x: next.x ?? prev.x,
  y: next.y ?? prev.y,
  width: next.width ?? prev.width,
  height: next.height ?? prev.height,
})

const geometryEquals = (a: WindowGeometry = {}, b: WindowGeometry = {}) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: fallbackSettings,
  loading: false,
  error: undefined,
  async loadSettings() {
    set({ loading: true })
    try {
      const data = await fetchSettings()
      set({ settings: data, loading: false })
    } catch (error) {
      set({ loading: false, error: toMessage(error) })
    }
  },
  async saveSettings(next) {
    try {
      const saved = await saveSettings(next)
      set({ settings: saved })
      return saved
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async updateFloatingOpacity(opacity) {
    const current = get().settings
    const updated = { ...current, floatingOpacity: opacity }
    try {
      const saved = await saveSettings(updated)
      set({ settings: saved })
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async toggleShowCompleted() {
    const current = get().settings
    const updated = { ...current, showCompletedInFloating: !current.showCompletedInFloating }
    try {
      const saved = await saveSettings(updated)
      set({ settings: saved })
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async toggleAlwaysOnTop(next) {
    const current = get().settings
    const target = typeof next === 'boolean' ? next : !current.alwaysOnTop
    const updated = { ...current, alwaysOnTop: target }
    try {
      const saved = await saveSettings(updated)
      set({ settings: saved })
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async persistWindowGeometry(label, geometry) {
    const current = get().settings
    const currentGeometry = current.windowState[label] ?? {}
    const mergedGeometry = mergeGeometry(current.windowState[label] ?? {}, geometry)
    if (geometryEquals(currentGeometry, mergedGeometry)) {
      return
    }
    const merged: UserSettings = {
      ...current,
      windowState: {
        ...current.windowState,
        [label]: mergedGeometry,
      },
    }
    set({ settings: merged })
    try {
      const saved = await recordWindowState(label, mergedGeometry)
      set({ settings: saved })
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  clearError() {
    set({ error: undefined })
  },
}))
