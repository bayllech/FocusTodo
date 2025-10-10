import { create } from 'zustand'

import {
  createTodo,
  deleteTodo,
  listTodos,
  toggleTodo,
  updateTodo,
} from '../services/api'
import type { TodoDraft, TodoItem } from '../types'

const defaultDraft: TodoDraft = {
  title: '',
  priority: 'medium',
  tags: [],
}

interface TodoState {
  todos: TodoItem[]
  loading: boolean
  error?: string
  loadTodos: () => Promise<void>
  addTodo: (draft: TodoDraft) => Promise<TodoItem>
  updateTodo: (todo: TodoItem) => Promise<TodoItem>
  removeTodo: (id: string) => Promise<void>
  toggleTodo: (id: string, completed: boolean) => Promise<TodoItem>
  clearError: () => void
}

const toMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],
  loading: false,
  error: undefined,
  async loadTodos() {
    set({ loading: true, error: undefined })
    try {
      const data = await listTodos()
      set({ todos: data, loading: false })
    } catch (error) {
      set({ loading: false, error: toMessage(error) })
    }
  },
  async addTodo(draft) {
    const payload = {
      ...defaultDraft,
      ...draft,
      tags: draft.tags ?? [],
    }
    try {
      const todo = await createTodo(payload)
      set((state) => ({
        todos: [...state.todos, todo],
      }))
      return todo
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async updateTodo(todo) {
    try {
      const updated = await updateTodo(todo)
      set((state) => ({
        todos: state.todos.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }))
      return updated
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async removeTodo(id) {
    try {
      await deleteTodo(id)
      set((state) => ({
        todos: state.todos.filter((item) => item.id !== id),
      }))
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  async toggleTodo(id, completed) {
    try {
      const next = await toggleTodo(id, completed)
      set((state) => ({
        todos: state.todos.map((item) =>
          item.id === next.id ? next : item,
        ),
      }))
      return next
    } catch (error) {
      set({ error: toMessage(error) })
      throw error
    }
  },
  clearError() {
    set({ error: undefined })
  },
}))
