import type { CloseRequestedEvent } from '@tauri-apps/api/window'
import { useEffect } from 'react'

import { useSettingsStore } from '../stores/settingsStore'

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const useWindowStateSync = () => {
  const persistWindowGeometry = useSettingsStore(
    (state) => state.persistWindowGeometry,
  )

  useEffect(() => {
    if (!isTauri) return

    let disposed = false
    let rafHandle: number | null = null
    const unlistenList: Array<() => void> = []

    const setup = async () => {
      try {
        const windowModule = await import('@tauri-apps/api/window')
        const eventModule = await import('@tauri-apps/api/event')

        if (disposed) return

        const currentWindow = windowModule.getCurrentWindow()
        const label = currentWindow.label
        if (label !== 'main' && label !== 'floating') {
          return
        }
        const windowLabel = label as 'main' | 'floating'

        const readGeometry = async () => {
          try {
            const [position, size] = await Promise.all([
              currentWindow.outerPosition(),
              currentWindow.outerSize(),
            ])
            return {
              x: position.x,
              y: position.y,
              width: size.width,
              height: size.height,
            }
          } catch {
            return {}
          }
        }

        const persist = async () => {
          try {
            const geometry = await readGeometry()
            await persistWindowGeometry(windowLabel, geometry)
          } catch {
            // 忽略持久化失败，继续使用内存状态
          }
        }

        const schedulePersist = () => {
          if (rafHandle !== null) {
            cancelAnimationFrame(rafHandle)
          }
          rafHandle = requestAnimationFrame(() => {
            void persist()
          })
        }

        unlistenList.push(
          await currentWindow.listen(
            eventModule.TauriEvent.WINDOW_MOVED,
            schedulePersist,
          ),
        )

        unlistenList.push(
          await currentWindow.listen(
            eventModule.TauriEvent.WINDOW_RESIZED,
            schedulePersist,
          ),
        )

        unlistenList.push(
          await currentWindow.onCloseRequested(
            async (event: CloseRequestedEvent) => {
              event.preventDefault()
              await persist()

              try {
                await currentWindow.hide()
              } catch {
                // 忽略隐藏窗口失败
              }
            },
          ),
        )
      } catch {
        // 忽略窗口同步初始化失败
      }
    }

    void setup()

    return () => {
      disposed = true
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle)
      }
      unlistenList.forEach((unlisten) => {
        try {
          unlisten()
        } catch {
          // 忽略事件清理失败
        }
      })
    }
  }, [persistWindowGeometry])
}

