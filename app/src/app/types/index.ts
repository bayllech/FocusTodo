export type TodoPriority = 'low' | 'medium' | 'high'

export interface TodoItem {
  id: string
  title: string
  detail?: string | null
  priority: TodoPriority
  tags: string[]
  plannedAt?: string | null
  dueAt?: string | null
  completed: boolean
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface TodoDraft {
  title: string
  detail?: string | null
  priority: TodoPriority
  tags: string[]
  plannedAt?: string | null
  dueAt?: string | null
}

export type PomodoroSessionKind = 'focus' | 'shortBreak' | 'longBreak'

export interface PomodoroConfig {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartNext: boolean
}

export interface PomodoroSession {
  id: string
  todoId?: string | null
  startAt: string
  endAt?: string | null
  durationMinutes?: number | null
  type: PomodoroSessionKind
  completed: boolean
}

export interface PomodoroSessionDraft {
  todoId?: string | null
  startAt: string
  endAt?: string | null
  durationMinutes?: number | null
  type: PomodoroSessionKind
  completed: boolean
}

export type ThemeMode = 'system' | 'light' | 'dark' | 'mac'

export interface HotkeySetting {
  toggleFloating?: string | null
  startOrPauseTimer?: string | null
}

export interface WindowGeometry {
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
}

export interface WindowState {
  main: WindowGeometry
  floating: WindowGeometry
}

export interface UserSettings {
  theme: ThemeMode
  followSystemTheme: boolean
  alwaysOnTop: boolean
  snapEdge: boolean
  floatingOpacity: number // 悬浮窗透明度 0.1-1.0
  showCompletedInFloating: boolean // 悬浮窗是否显示已完成任务
  hotkeys: HotkeySetting
  windowState: WindowState
}
