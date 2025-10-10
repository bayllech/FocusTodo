import { invoke } from '@tauri-apps/api/core'

import type {
  PomodoroConfig,
  PomodoroSession,
  PomodoroSessionDraft,
  TodoDraft,
  TodoItem,
  UserSettings,
  WindowGeometry,
} from '../types'

export const listTodos = () => invoke<TodoItem[]>('list_todos')

export const createTodo = (draft: TodoDraft) =>
  invoke<TodoItem>('create_todo', { draft })

export const updateTodo = (updated: TodoItem) =>
  invoke<TodoItem>('update_todo', { updated })

export const deleteTodo = (id: string) => invoke<void>('delete_todo', { id })

export const toggleTodo = (id: string, completed: boolean) =>
  invoke<TodoItem>('toggle_complete', { id, completed })

export const fetchPomodoroConfig = () =>
  invoke<PomodoroConfig>('get_pomodoro_config')

export const savePomodoroConfig = (config: PomodoroConfig) =>
  invoke<PomodoroConfig>('save_pomodoro_config', { config })

export const appendPomodoroSession = (draft: PomodoroSessionDraft) =>
  invoke<PomodoroSession>('append_pomodoro_session', { draft })

export const listPomodoroSessions = (date?: string) =>
  invoke<PomodoroSession[]>(
    'list_pomodoro_sessions',
    date ? { date } : {},
  )

export const fetchSettings = () => invoke<UserSettings>('get_settings')

export const saveSettings = (settings: UserSettings) =>
  invoke<UserSettings>('save_settings', { settings })

export const recordWindowState = (label: string, geometry: WindowGeometry) =>
  invoke<UserSettings>('record_window_state', { label, geometry })
