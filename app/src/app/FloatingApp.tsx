import dayjs from 'dayjs'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { FloatingPomodoroDisplay } from './components/FloatingPomodoroDisplay'
import { useWindowStateSync } from './hooks/useWindowStateSync'
import { useTodoStore } from './stores/todoStore'
import { usePomodoroStore } from './stores/pomodoroStore'
import { useSettingsStore } from './stores/settingsStore'

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const applyThemeOpacity = (opacity: number) => {
  const shell = clamp(opacity, 0.25, 1)
  const surface = clamp(shell + 0.08, 0.32, 0.95)
  const card = clamp(shell + 0.16, 0.4, 0.98)
  const cardCompleted = clamp(card - 0.06, 0.3, 0.92)
  const input = clamp(shell + 0.12, 0.35, 0.92)
  const border = clamp(shell - 0.18, 0.12, 0.45)
  const button = clamp(shell - 0.05, 0.2, 0.55)
  const accent = clamp(shell + 0.25, 0.45, 0.85)

  const set = (name: string, value: string) =>
    document.documentElement.style.setProperty(name, value)

  set('--floating-shell-bg', `rgba(15, 23, 42, ${shell.toFixed(2)})`)
  set('--floating-surface-bg', `rgba(21, 30, 47, ${surface.toFixed(2)})`)
  set('--floating-card-bg', `rgba(30, 41, 59, ${card.toFixed(2)})`)
  set(
    '--floating-card-completed-bg',
    `rgba(71, 85, 105, ${cardCompleted.toFixed(2)})`,
  )
  set('--floating-input-bg', `rgba(15, 23, 42, ${input.toFixed(2)})`)
  set('--floating-border-color', `rgba(148, 163, 184, ${border.toFixed(2)})`)
  set('--floating-button-bg', `rgba(248, 250, 252, ${button.toFixed(2)})`)
  set(
    '--floating-button-hover-bg',
    `rgba(248, 250, 252, ${(button + 0.08).toFixed(2)})`,
  )
  set('--floating-accent-bg', `rgba(96, 165, 250, ${accent.toFixed(2)})`)
  set(
    '--floating-accent-hover-bg',
    `rgba(96, 165, 250, ${clamp(accent + 0.1, 0.5, 0.95).toFixed(2)})`,
  )
}

export const FloatingApp = () => {
  useWindowStateSync()

  const todos = useTodoStore((state) => state.todos)
  const loadTodos = useTodoStore((state) => state.loadTodos)
  const toggleTodo = useTodoStore((state) => state.toggleTodo)
  const addTodo = useTodoStore((state) => state.addTodo)

  const loadConfig = usePomodoroStore((state) => state.loadConfig)

  const settings = useSettingsStore((state) => state.settings)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const toggleShowCompleted = useSettingsStore(
    (state) => state.toggleShowCompleted,
  )

  const [quickTitle, setQuickTitle] = useState('')
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

  useEffect(() => {
    void loadTodos()
    void loadConfig()
    void loadSettings()
  }, [loadTodos, loadConfig, loadSettings])

  useEffect(() => {
    applyThemeOpacity(settings.floatingOpacity)
  }, [settings.floatingOpacity])

  useEffect(() => {
    if (!isTauri) return

    let unlisten: (() => void) | undefined

    const setup = async () => {
      const { listen } = await import('@tauri-apps/api/event')
      unlisten = await listen<{ opacity: number }>('opacity-changed', (event) => {
        applyThemeOpacity(event.payload.opacity)
        void loadSettings()
      })
    }

    void setup()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [loadSettings])

  const activeTodos = useMemo(() => {
    return [...todos]
      .filter((todo) => !todo.completed)
      .sort((a, b) =>
        dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf(),
      )
  }, [todos])

  const completedTodos = useMemo(() => {
    return [...todos]
      .filter((todo) => todo.completed)
      .sort((a, b) =>
        dayjs(b.completedAt ?? b.createdAt).valueOf() -
        dayjs(a.completedAt ?? a.createdAt).valueOf(),
      )
  }, [todos])

  const completedToday = useMemo(
    () =>
      todos.filter(
        (todo) =>
          todo.completed &&
          todo.completedAt &&
          dayjs(todo.completedAt).isSame(dayjs(), 'day'),
      ).length,
    [todos],
  )

  const handleQuickAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = quickTitle.trim()
    if (!trimmed) {
      setQuickError('请输入任务标题')
      return
    }
    setQuickError(null)
    setQuickSubmitting(true)
    try {
      await addTodo({
        title: trimmed,
        priority: 'medium',
        tags: [],
      })
      setQuickTitle('')
      await loadTodos()
    } catch (error) {
      console.error('悬浮窗创建任务失败', error)
      setQuickError(
        error instanceof Error ? error.message : '创建任务失败',
      )
    } finally {
      setQuickSubmitting(false)
    }
  }

  const handleOpenMain = async () => {
    if (!isTauri) return
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const main = await WebviewWindow.getByLabel('main')
      if (!main) {
        console.warn('未找到主面板窗口实例')
        return
      }

      let minimized = false
      try {
        minimized = await main.isMinimized()
      } catch (error) {
        console.warn('检测主面板最小化状态失败', error)
      }

      if (minimized) {
        try {
          await main.unminimize()
        } catch (error) {
          console.warn('取消主面板最小化失败', error)
        }
      }

      try {
        const visible = await main.isVisible()
        if (!visible) {
          await main.show()
        }
      } catch (error) {
        console.warn('检测主面板可见性失败', error)
        await main.show()
      }

      await main.setFocus()
    } catch (error) {
      console.error('主面板唤起失败', error)
    }
  }


  const handleHide = async () => {
    if (!isTauri) return
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      await getCurrentWebviewWindow().hide()
    } catch (error) {
      console.error('隐藏悬浮窗失败', error)
    }
  }

  return (
    <div className="floating-shell" data-tauri-drag-region>
      <header className="floating-header">
        <span className="floating-title">专注待办 · 悬浮窗</span>
        <div className="floating-actions">
          <button
            type="button"
            className="floating-button"
            onClick={() => void loadTodos()}
          >
            刷新
          </button>
          <button
            type="button"
            className="floating-button"
            onClick={handleOpenMain}
          >
            打开主面板
          </button>
          <button
            type="button"
            className="floating-button"
            onClick={handleHide}
          >
            隐藏悬浮窗
          </button>
        </div>
      </header>

      <form className="floating-quick-form" onSubmit={handleQuickAdd}>
        <input
          className="floating-quick-input"
          placeholder="输入待办标题"
          value={quickTitle}
          onChange={(event) => {
            setQuickTitle(event.target.value)
            if (quickError) setQuickError(null)
          }}
          disabled={quickSubmitting}
        />
        <button
          type="submit"
          className="floating-quick-button"
          disabled={quickSubmitting}
        >
          {quickSubmitting ? '正在添加…' : '添加任务'}
        </button>
      </form>
      {quickError ? <p className="floating-quick-error">{quickError}</p> : null}

      <div className="floating-summary">
        <span>今日完成 {completedToday} 项</span>
        <span>剩余 {activeTodos.length} 项</span>
      </div>

      <FloatingPomodoroDisplay />

      <div className="floating-todo-container">
        <div className="floating-todo-scroll">
          <ul className="floating-todo-list">
            {activeTodos.length === 0 ? (
              <li className="floating-empty">暂无待办，保持专注！</li>
            ) : (
              activeTodos.map((todo) => (
                <li key={todo.id} className="floating-todo-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={(event) =>
                        void toggleTodo(todo.id, event.target.checked)
                      }
                    />
                    <span>{todo.title}</span>
                  </label>
                  <time>{dayjs(todo.createdAt).format('MM/DD HH:mm')}</time>
                </li>
              ))
            )}
          </ul>

          {settings.showCompletedInFloating && completedTodos.length > 0 ? (
            <>
              <h3 className="floating-subtitle">已完成</h3>
              <ul className="floating-todo-list">
                {completedTodos.map((todo) => (
                  <li key={todo.id} className="floating-todo-item completed">
                    <label>
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={(event) =>
                          void toggleTodo(todo.id, event.target.checked)
                        }
                      />
                      <span>{todo.title}</span>
                    </label>
                    <time>
                      {dayjs(todo.completedAt ?? todo.createdAt).format(
                        'MM/DD HH:mm',
                      )}
                    </time>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="floating-controls">
          <button
            type="button"
            className="toggle-completed-button"
            onClick={() => void toggleShowCompleted()}
          >
            {settings.showCompletedInFloating ? '隐藏已完成' : '显示已完成'}
          </button>
        </div>
      </div>
    </div>
  )
}


