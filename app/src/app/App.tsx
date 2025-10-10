import dayjs from 'dayjs'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { PomodoroTimer } from './components/PomodoroTimer'
import { TodoModal, type TodoFormValues } from './components/TodoModal'
import { usePomodoroStore } from './stores/pomodoroStore'
import { useSettingsStore } from './stores/settingsStore'
import { useTodoStore } from './stores/todoStore'
import { useWindowStateSync } from './hooks/useWindowStateSync'
import { ensureNotificationPermission } from './utils/notifications'
import type { PomodoroSession, TodoItem, TodoPriority } from './types'

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const priorityOptions: Array<{ label: string; value: TodoPriority }> = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]

const priorityLabels: Record<TodoPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

const sessionLabels: Record<PomodoroSession['type'], string> = {
  focus: '专注',
  shortBreak: '短休',
  longBreak: '长休',
}


const createEmptyFormValues = (): TodoFormValues => ({
  id: undefined,
  title: '',
  detail: '',
  priority: 'medium',
  tagsText: '',
  plannedAt: '',
  dueAt: '',
})

const toDateTimeInput = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DDTHH:mm') : ''

const toIsoString = (input: string) => {
  if (!input) return null
  const parsed = dayjs(input)
  return parsed.isValid() ? parsed.toISOString() : null
}

const parseTags = (tagsText: string) =>
  tagsText
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return '0 分钟'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins === 0 ? `${hours} 小时` : `${hours} 小时 ${mins} 分`
}

export const App = () => {
  useWindowStateSync()

  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [today] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [floatingBusy, setFloatingBusy] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [adjustingOpacity, setAdjustingOpacity] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalDeleting, setModalDeleting] = useState(false)
  const [modalValues, setModalValues] = useState<TodoFormValues>(() => createEmptyFormValues())
  const [activeTodo, setActiveTodo] = useState<TodoItem | null>(null)

  const [filterKeyword, setFilterKeyword] = useState('')
  const [filterPriority, setFilterPriority] = useState<'all' | TodoPriority>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')

  // 函数选择器:直接提取函数,避免创建新对象
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const settings = useSettingsStore((state) => state.settings)
  const updateFloatingOpacity = useSettingsStore((state) => state.updateFloatingOpacity)

  // 数据选择器:提取状态数据
  const todos = useTodoStore((state) => state.todos)
  const todoLoading = useTodoStore((state) => state.loading)
  const todoError = useTodoStore((state) => state.error)
  // 函数选择器:直接提取函数
  const loadTodos = useTodoStore((state) => state.loadTodos)
  const addTodo = useTodoStore((state) => state.addTodo)
  const toggleTodo = useTodoStore((state) => state.toggleTodo)
  const clearTodoError = useTodoStore((state) => state.clearError)

  const updateTodoItem = useTodoStore((state) => state.updateTodo)
  const removeTodo = useTodoStore((state) => state.removeTodo)

  // 数据选择器:提取状态数据
  const config = usePomodoroStore((state) => state.config)
  const sessions = usePomodoroStore((state) => state.sessions)
  const pomodoroLoading = usePomodoroStore((state) => state.loading)
  const pomodoroError = usePomodoroStore((state) => state.error)
  // 函数选择器:直接提取函数
  const loadConfig = usePomodoroStore((state) => state.loadConfig)
  const loadSessions = usePomodoroStore((state) => state.loadSessions)
  const saveConfig = usePomodoroStore((state) => state.saveConfig)
  const clearPomodoroError = usePomodoroStore((state) => state.clearError)

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    void loadTodos()
    void loadConfig()
    void loadSessions(today)
  }, [loadTodos, loadConfig, loadSessions, today])

  useEffect(() => {
    void ensureNotificationPermission()
  }, [])

  const sortedTodos = useMemo(() => {
    return [...todos].sort((a, b) => {
      if (a.completed === b.completed) {
        return dayjs(a.createdAt).isAfter(dayjs(b.createdAt)) ? -1 : 1
      }
      return a.completed ? 1 : -1
    })
  }, [todos])

  const filteredTodos = useMemo(() => {
    const keyword = filterKeyword.trim().toLowerCase()
    return sortedTodos.filter((todo) => {
      const matchPriority = filterPriority === 'all' || todo.priority === filterPriority
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'completed' ? todo.completed : !todo.completed)
      const matchKeyword =
        keyword.length === 0 ||
        todo.title.toLowerCase().includes(keyword) ||
        (todo.detail ?? '').toLowerCase().includes(keyword) ||
        todo.tags.some((tag) => tag.toLowerCase().includes(keyword))
      return matchPriority && matchStatus && matchKeyword
    })
  }, [sortedTodos, filterKeyword, filterPriority, filterStatus])

  const filtersActive =
    filterKeyword.trim().length > 0 || filterPriority !== 'all' || filterStatus !== 'all'

  const pomodoroSummary = useMemo(() => {
    const focusCompleted = sessions.filter(
      (session) => session.type === 'focus' && session.completed,
    ).length
    const minutes = sessions.reduce((acc, session) => {
      const fallback =
        session.type === 'focus'
          ? config.focusMinutes
          : session.type === 'shortBreak'
            ? config.shortBreakMinutes
            : config.longBreakMinutes
      return acc + (session.durationMinutes ?? fallback)
    }, 0)
    return { focusCompleted, minutes }
  }, [sessions, config])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await addTodo({
        title: trimmed,
        priority,
        tags: [],
      })
      setTitle('')
      setPriority('medium')
    } catch {
      // 错误信息已通过 store 暴露
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id: string, completed: boolean) => {
    try {
      await toggleTodo(id, completed)
    } catch {
      // 错误信息已通过 store 暴露
    }
  }

const handleOpenCreateModal = (defaults?: Partial<TodoFormValues>) => {
  setModalMode('create')
  setActiveTodo(null)
  setModalValues({
    ...createEmptyFormValues(),
    ...defaults,
  })
  setModalOpen(true)
}

const handleEditTodo = (todo: TodoItem) => {
  setModalMode('edit')
  setActiveTodo(todo)
  setModalValues({
    id: todo.id,
    title: todo.title,
    detail: todo.detail ?? '',
    priority: todo.priority,
    tagsText: todo.tags.join(', '),
    plannedAt: toDateTimeInput(todo.plannedAt ?? null),
    dueAt: toDateTimeInput(todo.dueAt ?? null),
  })
  setModalOpen(true)
}

const handleModalClose = () => {
  setModalOpen(false)
  setModalSaving(false)
  setModalDeleting(false)
  setActiveTodo(null)
  setModalValues(createEmptyFormValues())
}

const handleModalSubmit = async (form: TodoFormValues) => {
  const trimmedTitle = form.title.trim()
  if (!trimmedTitle) {
    alert('请填写任务标题')
    return
  }

  const detail = form.detail.trim()
  const tags = parseTags(form.tagsText)
  const plannedAtIso = toIsoString(form.plannedAt)
  const dueAtIso = toIsoString(form.dueAt)

  setModalSaving(true)
  try {
    if (modalMode === 'create') {
      await addTodo({
        title: trimmedTitle,
        detail: detail ? detail : null,
        priority: form.priority,
        tags,
        plannedAt: plannedAtIso,
        dueAt: dueAtIso,
      })
      setTitle('')
      setPriority('medium')
    } else if (activeTodo) {
      await updateTodoItem({
        ...activeTodo,
        title: trimmedTitle,
        detail: detail ? detail : null,
        priority: form.priority,
        tags,
        plannedAt: plannedAtIso,
        dueAt: dueAtIso,
      })
    }
    handleModalClose()
  } catch (error) {
    console.error('保存待办失败', error)
    alert('保存待办失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    setModalSaving(false)
  }
}

const handleModalDelete = async () => {
  if (!activeTodo) return
  if (!confirm('确认要删除该任务吗？')) {
    return
  }
  setModalDeleting(true)
  try {
    await removeTodo(activeTodo.id)
    handleModalClose()
  } catch (error) {
    console.error('删除待办失败', error)
    alert('删除待办失败：' + (error instanceof Error ? error.message : String(error)))
  } finally {
    setModalDeleting(false)
  }
}

const handleOpenAdvancedCreate = () => {
  handleOpenCreateModal({
    title,
    priority,
  })
}

const handleResetFilters = () => {
  setFilterKeyword('')
  setFilterPriority('all')
  setFilterStatus('all')
}

  const handleToggleFloating = async () => {
    if (!isTauri) return
    setFloatingBusy(true)
    try {
      const { getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow')

      // 使用 getAllWebviewWindows 函数获取所有窗口
      const windows = await getAllWebviewWindows()
      const floating = windows.find(w => w.label === 'floating')

      if (!floating) {
        alert('悬浮窗未找到，请检查配置')
        return
      }

      const visible = await floating.isVisible()

      if (visible) {
        await floating.hide()
      } else {
        await floating.show()
        await floating.setFocus()
      }
    } catch (error) {
      console.error('切换悬浮窗失败', error)
      alert('切换悬浮窗失败: ' + error)
    } finally {
      setFloatingBusy(false)
    }
  }
  const handleToggleAutoStart = async () => {
    setSavingConfig(true)
    try {
      await saveConfig({
        ...config,
        autoStartNext: !config.autoStartNext,
      })
    } catch {
      // 错误信息已通过 store 暴露
    } finally {
      setSavingConfig(false)
    }
  }

  const handleOpacityChange = async (value: number) => {
    setAdjustingOpacity(true)
    try {
      await updateFloatingOpacity(value)
      // 通过 Tauri 事件通知悬浮窗更新透明度
      if (isTauri) {
        const { emit } = await import('@tauri-apps/api/event')
        await emit('opacity-changed', { opacity: value })
      }
    } catch (error) {
      console.error('更新透明度失败', error)
    } finally {
      setAdjustingOpacity(false)
    }
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="app-section todo-section">
                    <header className="section-header">
            <div>
              <h2>任务列表</h2>
              <p>任务会实时写入本地文件，并同步到悬浮窗视图。</p>
            </div>
            <div className="section-actions">
              {isTauri ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleToggleFloating()}
                  disabled={floatingBusy}
                >
                  {floatingBusy ? '处理中…' : '切换悬浮窗'}
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  clearTodoError()
                  void loadTodos()
                }}
                disabled={todoLoading}
              >
                {todoLoading ? '刷新中…' : '刷新'}
              </button>
            </div>
          </header>

          <form className="todo-form" onSubmit={handleSubmit}>
            <input
              className="todo-input"
              placeholder="输入待办标题，例如：撰写需求文档"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={submitting}
            />
            <select
              className="todo-select"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TodoPriority)
              }
              disabled={submitting}
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}优先级
                </option>
              ))}
            </select>
            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? '添加中…' : '添加任务'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleOpenAdvancedCreate}
              disabled={submitting}
            >
              高级新建
            </button>
          </form>


<div className="todo-filters">
  <input
    className="filter-input"
    placeholder="搜索关键词，例如标签或标题"
    value={filterKeyword}
    onChange={(event) => setFilterKeyword(event.target.value)}
  />
  <select
    className="filter-select"
    value={filterPriority}
    onChange={(event) =>
      setFilterPriority(event.target.value as 'all' | TodoPriority)
    }
  >
    <option value="all">全部优先级</option>
    {priorityOptions.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}优先级
      </option>
    ))}
  </select>
  <select
    className="filter-select"
    value={filterStatus}
    onChange={(event) =>
      setFilterStatus(event.target.value as 'all' | 'active' | 'completed')
    }
  >
    <option value="all">全部状态</option>
    <option value="active">未完成</option>
    <option value="completed">已完成</option>
  </select>
  <button
    type="button"
    className="ghost-button"
    onClick={handleResetFilters}
    disabled={!filtersActive}
  >
    重置筛选
  </button>
</div>

          {todoError ? (
            <p className="app-error">任务操作失败：{todoError}</p>
          ) : null}



{filteredTodos.length === 0 ? (
  sortedTodos.length === 0 ? (
    <div className="empty-state">
      <p>当前还没有任务，添加第一个待办吧。</p>
    </div>
  ) : (
    <div className="empty-state">
      <p>没有符合筛选条件的任务，试试调整筛选器。</p>
    </div>
  )
) : (
  <ul className="todo-list">
    {filteredTodos.map((todo) => (
      <li
        key={todo.id}
        className={`todo-item ${todo.completed ? 'is-completed' : ''}`}
      >
        <label className="todo-checkbox">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={(event) =>
              void handleToggle(todo.id, event.target.checked)
            }
          />
          <span className="todo-title">{todo.title}</span>
        </label>
        <div className="todo-meta">
          <span
            className={`priority-tag priority-${todo.priority}`}
          >
            优先级：{priorityLabels[todo.priority]}
          </span>
          <span className="meta-text">
            创建于 {dayjs(todo.createdAt).format('YYYY/MM/DD HH:mm')}
          </span>
          {todo.completedAt ? (
            <span className="meta-text">
              完成于{' '}
              {dayjs(todo.completedAt).format('YYYY/MM/DD HH:mm')}
            </span>
          ) : null}
        </div>
        <div className="todo-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => handleEditTodo(todo)}
          >
            编辑
          </button>
        </div>
      </li>
    ))}
  </ul>
)}

        </section>

        <section className="app-section pomodoro-section">
          <header className="section-header">
            <div>
              <h2>番茄时钟</h2>
              <p>使用番茄工作法保持专注，完成后会自动记录并发送通知。</p>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                clearPomodoroError()
                void loadConfig()
                void loadSessions(today)
              }}
              disabled={pomodoroLoading}
            >
              {pomodoroLoading ? '同步中…' : '刷新记录'}
            </button>
          </header>

          {pomodoroError ? (
            <p className="app-error">番茄钟操作失败：{pomodoroError}</p>
          ) : null}

          <PomodoroTimer />

          <div className="config-summary">
            <h3>当前配置</h3>
            <div className="config-grid">
            <div className="config-card">
              <span className="config-label">专注时长</span>
              <strong>{config.focusMinutes} 分钟</strong>
            </div>
            <div className="config-card">
              <span className="config-label">短休时长</span>
              <strong>{config.shortBreakMinutes} 分钟</strong>
            </div>
            <div className="config-card">
              <span className="config-label">长休时长</span>
              <strong>{config.longBreakMinutes} 分钟</strong>
            </div>
            <div className="config-card">
              <span className="config-label">长休间隔</span>
              <strong>每 {config.longBreakInterval} 轮</strong>
            </div>
            <div className="config-card">
              <span className="config-label">今日统计</span>
              <strong>
                {pomodoroSummary.focusCompleted} 个番茄 ·{' '}
                {formatMinutes(pomodoroSummary.minutes)}
              </strong>
            </div>
          </div>

          <div className="config-actions">
            <label className="config-toggle">
              <input
                type="checkbox"
                checked={config.autoStartNext}
                onChange={() => void handleToggleAutoStart()}
                disabled={savingConfig}
              />
              <span>自动进入下一阶段</span>
            </label>
            <span className="toggle-hint">
              {savingConfig
                ? '保存中…'
                : '启用后番茄结束将自动切换到休息阶段'}
            </span>
          </div>

          <div className="config-actions">
            <div className="opacity-control">
              <label>
                <span>悬浮窗透明度</span>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={settings.floatingOpacity}
                  onChange={(e) => void handleOpacityChange(parseFloat(e.target.value))}
                  disabled={adjustingOpacity}
                />
                <span className="opacity-value">{Math.round(settings.floatingOpacity * 100)}%</span>
              </label>
            </div>
            <span className="toggle-hint">
              {adjustingOpacity ? '调整中…' : '调整悬浮窗的透明度，需要CSS支持'}
            </span>
          </div>
          </div>

          <div className="session-list">
            <h3>今日番茄记录</h3>
            {sessions.length === 0 ? (
              <p className="meta-text">
                还没有完成任何番茄，开始你的第一个专注时段吧!
              </p>
            ) : (
              <ul>
                {sessions.slice(-5).map((session) => (
                  <li key={session.id}>
                    <span className={`session-tag session-${session.type}`}>
                      {sessionLabels[session.type]}
                    </span>
                    <span className="meta-text">
                      {dayjs(session.startAt).format('HH:mm')}
                      {session.endAt
                        ? ` - ${dayjs(session.endAt).format('HH:mm')}`
                        : ''}
                    </span>
                    <span className="meta-text">
                      时长{' '}
                      {formatMinutes(
                        session.durationMinutes ??
                          (session.type === 'focus'
                            ? config.focusMinutes
                            : session.type === 'shortBreak'
                              ? config.shortBreakMinutes
                              : config.longBreakMinutes),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <TodoModal
        open={modalOpen}
        mode={modalMode}
        values={modalValues}
        saving={modalSaving}
        deleting={modalDeleting}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        onDelete={modalMode === 'edit' ? handleModalDelete : undefined}
      />
    </div>
  )
}
