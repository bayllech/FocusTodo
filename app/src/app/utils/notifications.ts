let audioContext: AudioContext | null = null

const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const ensureAudioContext = () => {
  if (typeof window === 'undefined') {
    return null
  }
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

const playChime = () => {
  const ctx = ensureAudioContext()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, ctx.currentTime)
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 1)
}

export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (!isTauri) {
    return false
  }
  const {
    isPermissionGranted,
    requestPermission,
  } = await import('@tauri-apps/plugin-notification')

  if (await isPermissionGranted()) {
    return true
  }

  try {
    const permission = await requestPermission()
    return permission === 'granted'
  } catch (error) {
    console.error('请求通知权限失败', error)
    return false
  }
}

export const notifyPomodoroCompletion = async (
  title: string,
  body: string,
) => {
  if (!isTauri) return
  const { sendNotification } = await import('@tauri-apps/plugin-notification')
  const granted = await ensureNotificationPermission()
  if (!granted) return
  await sendNotification({ title, body })
  playChime()
}
