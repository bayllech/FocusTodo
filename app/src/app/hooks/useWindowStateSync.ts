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
          } catch (error) {
            console.error('Failed to read window geometry', error)
            return {}
          }
        }

        const persist = async () => {
          try {
            const geometry = await readGeometry()
            await persistWindowGeometry(windowLabel, geometry)
          } catch (error) {
            console.error('Failed to persist window geometry', error)
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
              } catch (error) {
                console.error('Failed to hide window', error)
              }
            },
          ),
        )
      } catch (error) {
        console.error('Failed to initialise window state sync', error)
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
        } catch (error) {
          console.error('Failed to remove window listeners', error)
        }
      })
    }
  }, [persistWindowGeometry])
}

