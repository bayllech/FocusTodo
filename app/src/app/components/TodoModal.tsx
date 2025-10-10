import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

import type { TodoPriority } from '../types'

interface TodoFormValues {
  id?: string
  title: string
  detail: string
  priority: TodoPriority
  tagsText: string
  plannedAt: string
  dueAt: string
}

interface TodoModalProps {
  open: boolean
  mode: 'create' | 'edit'
  values: TodoFormValues
  saving: boolean
  deleting: boolean
  onClose: () => void
  onSubmit: (values: TodoFormValues) => Promise<void>
  onDelete?: () => Promise<void>
}

const priorityOptions: Array<{ label: string; value: TodoPriority }> = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]

const formatTitle = (mode: 'create' | 'edit') =>
  mode === 'create' ? '新建待办' : '编辑待办'

export const TodoModal = ({
  open,
  mode,
  values,
  saving,
  deleting,
  onClose,
  onSubmit,
  onDelete,
}: TodoModalProps) => {
  const [formValues, setFormValues] = useState(values)
  const modalTitle = useMemo(() => formatTitle(mode), [mode])

  useEffect(() => {
    if (open) {
      setFormValues(values)
    }
  }, [values, open])

  const handleChange = <Key extends keyof TodoFormValues>(
    key: Key,
    value: TodoFormValues[Key],
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onSubmit(formValues)
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-shell" role="dialog" aria-modal="true">
        <header className="modal-header">
          <h3>{modalTitle}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>标题</span>
            <input
              type="text"
              value={formValues.title}
              onChange={(event) => handleChange('title', event.target.value)}
              placeholder="例如：编写功能设计文档"
              required
            />
          </label>

          <label className="modal-field">
            <span>详情</span>
            <textarea
              value={formValues.detail}
              onChange={(event) => handleChange('detail', event.target.value)}
              rows={3}
              placeholder="补充背景、目标或验收标准"
            />
          </label>

          <label className="modal-field">
            <span>标签</span>
            <input
              type="text"
              value={formValues.tagsText}
              onChange={(event) => handleChange('tagsText', event.target.value)}
              placeholder="使用逗号分隔，例如：工作,设计"
            />
          </label>

          <label className="modal-field">
            <span>优先级</span>
            <select
              value={formValues.priority}
              onChange={(event) =>
                handleChange('priority', event.target.value as TodoPriority)
              }
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="modal-grid">
            <label className="modal-field">
              <span>计划时间</span>
              <input
                type="datetime-local"
                value={formValues.plannedAt}
                onChange={(event) =>
                  handleChange('plannedAt', event.target.value)
                }
              />
            </label>
            <label className="modal-field">
              <span>截止时间</span>
              <input
                type="datetime-local"
                value={formValues.dueAt}
                onChange={(event) => handleChange('dueAt', event.target.value)}
              />
            </label>
          </div>

          <footer className="modal-footer">
            {mode === 'edit' && onDelete ? (
              <button
                type="button"
                className="danger-button"
                onClick={() => void onDelete()}
                disabled={saving || deleting}
              >
                {deleting ? '删除中…' : '删除任务'}
              </button>
            ) : (
              <span />
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={onClose}
                disabled={saving}
              >
                取消
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}

export type { TodoFormValues }
