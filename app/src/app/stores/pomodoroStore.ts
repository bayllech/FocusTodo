import dayjs from 'dayjs'
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
  PomodoroSessionKind,
} from '../types'

export type TimerState = 'idle' | 'running' | 'paused'

export interface PomodoroState {
  config: PomodoroConfig
  sessions: PomodoroSession[]
  loading: boolean
  error?: string
  timerState: TimerState
  sessionType: PomodoroSessionKind
  durationSeconds: number
  remainingSeconds: number
  sessionStartTime: string | null
  focusCount: number
  loadConfig: () => Promise<void>
  saveConfig: (config: PomodoroConfig) => Promise<PomodoroConfig>
  loadSessions: (date?: string) => Promise<void>
  addSession: (draft: PomodoroSessionDraft) => Promise<PomodoroSession>
  clearError: () => void
  start: (type?: PomodoroSessionKind) => void
  pause: () => void
  reset: (type?: PomodoroSessionKind) => void
  tick: () => void
  switchType: (type: PomodoroSessionKind) => void
}

const fallbackConfig: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartNext: false,
}

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const SESSION_LABEL: Record<PomodoroSession['type'], string> = {
  focus: '专注阶段已完成',
  shortBreak: '短休阶段已结束',
  longBreak: '长休阶段已结束',
}

const SESSION_SUMMARY: Record<PomodoroSession['type'], string> = {
  focus: '恭喜完成一次专注，准备进入恢复阶段。',
  shortBreak: '稍作休息，新的专注循环即将开始。',
  longBreak: '长休结束，开启全新的专注循环吧。',
}


const hasWindow = typeof window !== 'undefined'
const WINDOW_ID =
  hasWindow && typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `pomodoro-${Math.random().toString(16).slice(2)}`
const LEADER_STORAGE_KEY = 'focus-todo:pomodoro-leader'
const LEADER_TTL = 15000
const broadcastChannel =
  hasWindow && 'BroadcastChannel' in window
    ? new BroadcastChannel('focus-todo:pomodoro-store')
    : null

const logTimerDebug = (..._args: unknown[]) => {}

let leaderExpiry = 0
let isTimerLeader = false
let timerHandle: ReturnType<typeof setInterval> | null = null
let isApplyingRemoteUpdate = false
let lastSyncedStamp = 0
let channelBound = false
let broadcastVersion = 0
let lastSyncedVersion = 0

const readLeaderRecord = () => {
  if (!hasWindow) return null
  try {
    const raw = window.localStorage.getItem(LEADER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      ownerId?: string
      expiresAt?: number
    }
    if (
      typeof parsed.ownerId === 'string' &&
      typeof parsed.expiresAt === 'number'
    ) {
      return parsed
    }
    return null
  } catch (error) {
    return null
  }
}

const writeLeaderRecord = (ownerId: string, expiresAt: number) => {
  if (!hasWindow) return
  try {
    window.localStorage.setItem(
      LEADER_STORAGE_KEY,
      JSON.stringify({ ownerId, expiresAt }),
    )
  } catch {
    // 忽略持久化失败
  }
}

const clearLeaderRecord = (ownerId: string) => {
  if (!hasWindow) return
  try {
    const current = readLeaderRecord()
    if (!current || current.ownerId !== ownerId) return
    window.localStorage.removeItem(LEADER_STORAGE_KEY)
  } catch {
    // 忽略删除失败
  }
}

const claimLeadership = (force = false): boolean => {
  if (!hasWindow) {
    isTimerLeader = true
    logTimerDebug('claim leadership (no-window) -> leader')
    return true
  }
  const now = Date.now()
  const record = readLeaderRecord()
  if (record) {
    if (record.ownerId === WINDOW_ID) {
      leaderExpiry = now + LEADER_TTL
      writeLeaderRecord(WINDOW_ID, leaderExpiry)
      isTimerLeader = true
      logTimerDebug('refresh leadership', { expiresAt: new Date(leaderExpiry).toISOString(), force })
      return true
    }
    if (!force && record.expiresAt && record.expiresAt > now) {
      isTimerLeader = false
      logTimerDebug('claim leadership blocked', {
        owner: record.ownerId,
        expiresAt: new Date(record.expiresAt).toISOString(),
      })
      return false
    }
  }
  leaderExpiry = now + LEADER_TTL
  writeLeaderRecord(WINDOW_ID, leaderExpiry)
  isTimerLeader = true
  logTimerDebug('claim leadership success', { force, previousOwner: record?.ownerId ?? null, expiresAt: new Date(leaderExpiry).toISOString() })
  return true
}

const refreshLeadership = () => {
  if (!hasWindow || !isTimerLeader) return
  const now = Date.now()
  if (leaderExpiry - now < LEADER_TTL / 2) {
    leaderExpiry = now + LEADER_TTL
    writeLeaderRecord(WINDOW_ID, leaderExpiry)
    logTimerDebug('refresh leadership TTL', {
      expiresAt: new Date(leaderExpiry).toISOString(),
    })
  }
}

const releaseLeadership = () => {
  if (!hasWindow) return
  clearLeaderRecord(WINDOW_ID)
  isTimerLeader = false
  leaderExpiry = 0
  logTimerDebug('release leadership')
}

const broadcastState = (getState: () => PomodoroState, force = false) => {
  if (!broadcastChannel || isApplyingRemoteUpdate) return
  if (!force && !isTimerLeader) return
  try {
    const state = getState()
    const version = ++broadcastVersion
    const payload = {
      timerState: state.timerState,
      sessionType: state.sessionType,
      durationSeconds: state.durationSeconds,
      remainingSeconds: state.remainingSeconds,
      sessionStartTime: state.sessionStartTime,
      focusCount: state.focusCount,
      config: state.config,
      updatedAt: Date.now(),
      version,
    }
    lastSyncedStamp = payload.updatedAt
    lastSyncedVersion = version
    logTimerDebug('broadcast state', {
      version,
      timerState: payload.timerState,
      sessionType: payload.sessionType,
      remainingSeconds: payload.remainingSeconds,
      force,
    })
    broadcastChannel.postMessage({
      type: 'state',
      source: WINDOW_ID,
      payload,
    })
  } catch {
    // 忽略广播失败
  }
}

interface PomodoroBroadcastMessage {
  type: 'state'
  source: string
  payload: {
    timerState: TimerState
    sessionType: PomodoroSessionKind
    durationSeconds: number
    remainingSeconds: number
    sessionStartTime: string | null
    focusCount: number
    config: PomodoroConfig
    updatedAt: number
    version: number
  }
}

if (hasWindow) {
  window.addEventListener('beforeunload', () => {
    logTimerDebug('beforeunload -> release leadership')
    releaseLeadership()
  })

  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage) return
    if (event.key !== LEADER_STORAGE_KEY) return
    const record = readLeaderRecord()
    if (!record || record.ownerId !== WINDOW_ID) {
      if (isTimerLeader) {
        logTimerDebug('storage event: leadership changed', { newOwner: record?.ownerId })
      }
      isTimerLeader = false
    } else {
      isTimerLeader = true
      leaderExpiry = record.expiresAt ?? Date.now() + LEADER_TTL
      logTimerDebug('storage event: confirm leadership', {
        expiresAt: new Date(leaderExpiry).toISOString(),
      })
    }
  })
}


export const usePomodoroStore = create<PomodoroState>((set, get) => {
  const computeDurationSeconds = (
    type: PomodoroSessionKind,
    config?: PomodoroConfig,
  ) => {
    const effectiveConfig = config ?? get().config
    switch (type) {
      case 'focus':
        return effectiveConfig.focusMinutes * 60
      case 'shortBreak':
        return effectiveConfig.shortBreakMinutes * 60
      case 'longBreak':
        return effectiveConfig.longBreakMinutes * 60
      default:
        return effectiveConfig.focusMinutes * 60
    }
  }

  const startTimerLoop = () => {
    if (timerHandle !== null || !isTimerLeader) return
    logTimerDebug('start timer loop')
    timerHandle = setInterval(() => {
      get().tick()
    }, 1000)
  }

  const stopTimerLoop = () => {
    if (timerHandle !== null) {
      clearInterval(timerHandle)
      timerHandle = null
      logTimerDebug('stop timer loop')
    }
  }

  if (broadcastChannel && !channelBound) {
    const handleMessage = (event: MessageEvent<PomodoroBroadcastMessage>) => {
      const message = event.data
      if (!message || message.source === WINDOW_ID) {
        return
      }
      if (message.type !== 'state') {
        return
      }
      const { payload } = message
      if (payload.version <= lastSyncedVersion ||
        payload.updatedAt < lastSyncedStamp
      ) {
        logTimerDebug('skip remote message', {
          incomingVersion: payload.version,
          lastSyncedVersion,
          incomingAt: payload.updatedAt,
          lastSyncedStamp,
        })
        return
      }
      lastSyncedStamp = payload.updatedAt
      lastSyncedVersion = payload.version
      broadcastVersion = Math.max(broadcastVersion, payload.version)
      logTimerDebug('apply remote state', {
        from: message.source,
        version: payload.version,
        timerState: payload.timerState,
        sessionType: payload.sessionType,
        remainingSeconds: payload.remainingSeconds,
      })
      isTimerLeader = false
      isApplyingRemoteUpdate = true
      set({
        timerState: payload.timerState,
        sessionType: payload.sessionType,
        durationSeconds: payload.durationSeconds,
        remainingSeconds: payload.remainingSeconds,
        sessionStartTime: payload.sessionStartTime,
        focusCount: payload.focusCount,
        config: payload.config,
      })
      isApplyingRemoteUpdate = false
    }
    broadcastChannel.onmessage = handleMessage
    channelBound = true
  }

  const persistSession = async (draft: PomodoroSessionDraft) => {
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
  }

  const completeCurrentSession = async () => {
    const {
      sessionStartTime,
      sessionType,
      durationSeconds,
      focusCount,
      config,
    } = get()

    if (!sessionStartTime) {
      set((state) => ({
        timerState: 'idle',
        remainingSeconds: state.durationSeconds,
        sessionStartTime: null,
      }))
      releaseLeadership()
      stopTimerLoop()
      broadcastState(get, true)
      logTimerDebug('complete session skipped (no start time)')
      return
    }

    logTimerDebug('complete session begin', {
      sessionType,
      durationSeconds,
      focusCount,
    })
    set({ timerState: 'idle' })

    const endAt = dayjs().toISOString()
    const durationMinutes = Math.round(durationSeconds / 60)

    try {
      await persistSession({
        type: sessionType,
        startAt: sessionStartTime,
        endAt,
        durationMinutes,
        completed: true,
      })
    } catch (error) {
      set({ error: toMessage(error) })
    }

    const today = dayjs().format('YYYY-MM-DD')
    void get().loadSessions(today)

    let updatedFocusCount = focusCount
    if (sessionType === 'focus') {
      updatedFocusCount += 1
    } else if (sessionType === 'longBreak') {
      updatedFocusCount = 0
    }

    const shouldTakeLongBreak =
      sessionType === 'focus' &&
      config.longBreakInterval > 0 &&
      updatedFocusCount % config.longBreakInterval === 0

    const nextType: PomodoroSessionKind =
      sessionType === 'focus'
        ? shouldTakeLongBreak
          ? 'longBreak'
          : 'shortBreak'
        : 'focus'

    const nextDuration = computeDurationSeconds(nextType)
    const autoStart = config.autoStartNext

    set({
      timerState: autoStart ? 'running' : 'idle',
      sessionType: nextType,
      durationSeconds: nextDuration,
      remainingSeconds: nextDuration,
      sessionStartTime: autoStart ? dayjs().toISOString() : null,
      focusCount: updatedFocusCount,
    })

    if (autoStart) {
      const leader = claimLeadership()
      if (leader) {
        startTimerLoop()
      } else {
        stopTimerLoop()
        logTimerDebug('auto-start without leadership', { nextType })
      }
    } else {
      releaseLeadership()
      stopTimerLoop()
    }

    const nextState = get()
    broadcastState(get, nextState.timerState !== 'running')
    logTimerDebug('complete session end', {
      nextType: nextState.sessionType,
      autoStart,
      timerState: nextState.timerState,
      remainingSeconds: nextState.remainingSeconds,
      focusCount: nextState.focusCount,
    })
  }

  const initialDuration = computeDurationSeconds('focus', fallbackConfig)

  return {
    config: fallbackConfig,
    sessions: [],
    loading: false,
    error: undefined,
    timerState: 'idle',
    sessionType: 'focus',
    durationSeconds: initialDuration,
    remainingSeconds: initialDuration,
    sessionStartTime: null,
    focusCount: 0,
    async loadConfig() {
      try {
        const data = await fetchPomodoroConfig()
        set((state) => {
          const nextDuration = computeDurationSeconds(state.sessionType, data)
          return {
            config: data,
            ...(state.timerState === 'idle'
              ? {
                  durationSeconds: nextDuration,
                  remainingSeconds: nextDuration,
                }
              : {}),
          }
        })
        broadcastState(get, true)
      } catch (error) {
        set({ error: toMessage(error) })
      }
    },
    async saveConfig(config) {
      try {
        const saved = await savePomodoroConfig(config)
        set((state) => {
          const nextDuration = computeDurationSeconds(state.sessionType, saved)
          return {
            config: saved,
            ...(state.timerState === 'idle'
              ? {
                  durationSeconds: nextDuration,
                  remainingSeconds: nextDuration,
                }
              : {}),
          }
        })
        broadcastState(get, true)
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
      return persistSession(draft)
    },
    clearError() {
      set({ error: undefined })
    },
    start(type) {
      const current = get()
      if (
        current.timerState === 'running' &&
        (type === undefined || type === current.sessionType)
      ) {
        return
      }
      const leader = claimLeadership(true)
      if (!leader) {
        logTimerDebug('start request failed to claim leadership', { typeOverride: type })
        return
      }
      set((state) => {
        const nextType = type ?? state.sessionType
        const typeChanged = nextType !== state.sessionType
        const nextDuration = typeChanged
          ? computeDurationSeconds(nextType)
          : state.durationSeconds
        const shouldResetStart =
          typeChanged || state.sessionStartTime === null || state.timerState === 'idle'
        const nextRemaining =
          typeChanged || state.remainingSeconds <= 0
            ? nextDuration
            : state.remainingSeconds

        return {
          timerState: 'running' as TimerState,
          sessionType: nextType,
          durationSeconds: nextDuration,
          remainingSeconds: nextRemaining,
          sessionStartTime: shouldResetStart
            ? dayjs().toISOString()
            : state.sessionStartTime,
          focusCount:
            typeChanged && nextType === 'focus' && state.sessionType !== 'focus'
              ? 0
              : state.focusCount,
        }
      })

      startTimerLoop()

      const snapshot = get()
      broadcastState(get)
      logTimerDebug('start timer', {
        typeOverride: type,
        leader: true,
        timerState: snapshot.timerState,
        sessionType: snapshot.sessionType,
        remainingSeconds: snapshot.remainingSeconds,
      })
    },
    pause() {
      if (get().timerState !== 'running') {
        return
      }
      stopTimerLoop()
      set({ timerState: 'paused' })
      releaseLeadership()
      broadcastState(get, true)
      logTimerDebug('pause timer')
    },
    reset(type) {
      stopTimerLoop()
      set((state) => {
        const nextType = type ?? state.sessionType
        const nextDuration = computeDurationSeconds(nextType)
        return {
          timerState: 'idle' as TimerState,
          sessionType: nextType,
          durationSeconds: nextDuration,
          remainingSeconds: nextDuration,
          sessionStartTime: null,
          focusCount:
            nextType === 'focus' && state.sessionType !== 'focus'
              ? 0
              : state.focusCount,
        }
      })
      releaseLeadership()
      broadcastState(get, true)
      logTimerDebug('reset timer', { typeOverride: type })
    },
    tick() {
      const stateSnapshot = get()
      if (stateSnapshot.timerState !== 'running') {
        stopTimerLoop()
        logTimerDebug('tick ignored (not running)', { timerState: stateSnapshot.timerState })
        return
      }

      if (!isTimerLeader) {
        stopTimerLoop()
        logTimerDebug('tick ignored (not leader)')
        return
      }

      set((state) => {
        if (state.remainingSeconds <= 1) {
          return {
            remainingSeconds: 0,
          }
        }
        return {
          remainingSeconds: state.remainingSeconds - 1,
        }
      })

      const afterTick = get()
      if (afterTick.remainingSeconds === 0) {
        stopTimerLoop()
        refreshLeadership()
        logTimerDebug('tick reached zero, completing session')
        void completeCurrentSession()
        return
      }

      refreshLeadership()
      broadcastState(get)
      logTimerDebug('tick', { remainingSeconds: afterTick.remainingSeconds })
    },
    switchType(type) {
      const { sessionType } = get()
      if (type === sessionType) {
        return
      }
      stopTimerLoop()
      const nextDuration = computeDurationSeconds(type)
      set((state) => ({
        timerState: 'idle',
        sessionType: type,
        durationSeconds: nextDuration,
        remainingSeconds: nextDuration,
        sessionStartTime: null,
        focusCount:
          type === 'focus' && state.sessionType !== 'focus' ? 0 : state.focusCount,
      }))
      releaseLeadership()
      broadcastState(get, true)
      logTimerDebug('switch type', { target: type })
    },
  }
})
