import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './app'
import { FloatingApp } from './app/FloatingApp'
import './app/styles/theme.css'
import './app/styles/global.css'
import './app/styles/pomodoro.css'

const isTauriEnv =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const detectWindowLabel = async (): Promise<string> => {
  if (!isTauriEnv) return 'main'
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow().label ?? 'main'
  } catch {
    return 'main'
  }
}

const bootstrap = async () => {
  const rootElement = document.getElementById('app')
  if (!rootElement) {
    throw new Error('未找到应用根节点 #app')
  }

  const label = await detectWindowLabel()
  document.body.dataset.window = label
  document.documentElement.dataset.window = label

  const RootComponent = label === 'floating' ? FloatingApp : App

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <RootComponent />
    </React.StrictMode>,
  )
}

void bootstrap()
