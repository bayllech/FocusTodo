
import { create } from 'zustand'

import {
  appendPomodoroSession,
  fetchPomodoroConfig,
  listPomodoroSessions,
  savePomodoroConfig,
} from '../services/api'
import { notifyPomodoroCompletion } from '../utils/notifications'
import type {
  PomodoroConfig,
  PomodoroSession,
  PomodoroSessionDraft,
} from '../types'

const fallbackConfig: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
}

interface PomodoroState {
  config: PomodoroConfig
  sessions: PomodoroSession[]
  loading: boolean
  error?: string
  loadConfig: () => Promise<void>
  saveConfig: (config: PomodoroConfig) => Promise<PomodoroConfig>
  loadSessions: (date?: string) => Promise<void>
  addSession: (draft: PomodoroSessionDraft) => Promise<PomodoroSession>
  clearError: () => void
}

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const SESSION_LABEL: Record<PomodoroSession['type'], string> = {
  focus: '专注已完成',
  shortBreak: '短休结束',
  longBreak: '长休结束',
}

const SESSION_SUMMARY: Record<PomodoroSession['type'], string> = {
  focus: '准备好投入下一轮任务了吗？',
  shortBreak: '记得按照节奏开始下一轮哦。',
  longBreak: '记得按照节奏开始下一轮哦。',
}

export const usePomodoroStore = create<PomodoroState>((set) => ({
  config: fallbackConfig,
  sessions: [],
  loading: false,
  error: undefined,
  async loadConfig() {
    try {
      const data = await fetchPomodoroConfig()
      set({ config: data })
    } catch (error) {
      set({ error: toMessage(error) })
    }
  },
  async saveConfig(config) {
    try {
      const saved = await savePomodoroConfig(config)
      set({ config: saved })
      return saved
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async loadSessions(date) {
    set({ loading: true })
    try {
      const sessions = await listPomodoroSessions(date)
      set({ sessions, loading: false })
    } catch (error) {
      set({ loading: false, error: toMessage(error) })
    }
  },
  async addSession(draft) {
    try {
      const session = await appendPomodoroSession(draft)
      set((state) => ({
        sessions: [...state.sessions, session],
      }))
      if (session.completed) {
        const label = SESSION_LABEL[session.type]
        const summary = SESSION_SUMMARY[session.type]
        void notifyPomodoroCompletion(label, summary)
      }
      return session
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  clearError() {
    set({ error: undefined })
  },
}))
