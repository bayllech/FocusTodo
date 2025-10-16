import { useCallback } from 'react'

import { usePomodoroStore } from '../stores/pomodoroStore'
import type { PomodoroSessionKind } from '../types'

const SESSION_HINT: Record<PomodoroSessionKind, string> = {
  focus: '保持呼吸与节奏，专注正在进行。',
  shortBreak: '放松片刻，活动一下肩颈与手腕。',
  longBreak: '长休息时间到了，好好补充能量。',
}

const STAGE_LABEL: Record<PomodoroSessionKind, string> = {
  focus: '专注',
  shortBreak: '短休',
  longBreak: '长休',
}

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

interface PomodoroTimerProps {
  variant?: 'default' | 'compact'
  showSummary?: boolean
  mode?: 'full' | 'minimal'
}

export const PomodoroTimer = ({
  variant = 'default',
  showSummary = true,
  mode = 'full',
}: PomodoroTimerProps) => {
  const isCompact = variant === 'compact'
  const isMinimal = mode === 'minimal'

  const config = usePomodoroStore((state) => state.config)
  const timerState = usePomodoroStore((state) => state.timerState)
  const sessionType = usePomodoroStore((state) => state.sessionType)
  const remainingSeconds = usePomodoroStore((state) => state.remainingSeconds)
  const durationSeconds = usePomodoroStore((state) => state.durationSeconds)
  const focusCount = usePomodoroStore((state) => state.focusCount)
  const start = usePomodoroStore((state) => state.start)
  const pause = usePomodoroStore((state) => state.pause)
  const reset = usePomodoroStore((state) => state.reset)
  const switchType = usePomodoroStore((state) => state.switchType)

  const handleStart = useCallback(() => {
    start()
  }, [start])

  const handlePause = useCallback(() => {
    pause()
  }, [pause])

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  const handleSwitchType = useCallback(
    (type: PomodoroSessionKind) => {
      if (type === sessionType) {
        return
      }

      if (timerState !== 'idle') {
        const confirmed = window.confirm('切换阶段会重置当前计时，确认继续？')
        if (!confirmed) {
          return
        }
      }

      switchType(type)
    },
    [switchType, sessionType, timerState],
  )

  const totalSeconds = durationSeconds > 0 ? durationSeconds : 1
  const progressPercentage = Math.min(
    100,
    Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100),
  )

  const containerClassNames = ['pomodoro-timer']
  if (isCompact) {
    containerClassNames.push('compact')
  }
  if (isMinimal) {
    containerClassNames.push('bare', 'minimal')
  }

  if (isMinimal) {
    const actionLabel =
      timerState === 'running' ? '暂停' : timerState === 'paused' ? '继续' : '开始'
    const completionRatio =
      config.longBreakInterval > 0
        ? `${(focusCount % config.longBreakInterval) || config.longBreakInterval}/${config.longBreakInterval}`
        : ''

    return (
      <div className={containerClassNames.join(' ')}>
        <div className="timer-strip">
          <span className="timer-strip-stage">
            {STAGE_LABEL[sessionType]}
            {completionRatio ? <span className="timer-strip-sub">{completionRatio}</span> : null}
          </span>
          <span className="timer-strip-time">{formatTime(remainingSeconds)}</span>
          <div className="timer-strip-actions">
            <button
              type="button"
              className="timer-strip-button"
              onClick={timerState === 'running' ? handlePause : handleStart}
            >
              {actionLabel}
            </button>
            {timerState === 'paused' ? (
              <button type="button" className="timer-strip-button muted" onClick={handleReset}>
                重置
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClassNames.join(' ')}>
      <div className="timer-header">
        <div className="timer-type-selector">
          <button
            type="button"
            className={`type-button ${sessionType === 'focus' ? 'active' : ''}`}
            onClick={() => handleSwitchType('focus')}
            disabled={timerState === 'running'}
          >
            专注
          </button>
          <button
            type="button"
            className={`type-button ${sessionType === 'shortBreak' ? 'active' : ''}`}
            onClick={() => handleSwitchType('shortBreak')}
            disabled={timerState === 'running'}
          >
            短休
          </button>
          <button
            type="button"
            className={`type-button ${sessionType === 'longBreak' ? 'active' : ''}`}
            onClick={() => handleSwitchType('longBreak')}
            disabled={timerState === 'running'}
          >
            长休
          </button>
        </div>
      </div>

      {isCompact ? (
        <div className="timer-simple">
          <div className="timer-simple-time">{formatTime(remainingSeconds)}</div>
        </div>
      ) : (
        <div className="timer-display">
          <div className="timer-circle">
            <svg viewBox="0 0 200 200">
              <circle className="timer-track" cx="100" cy="100" r="90" fill="none" strokeWidth="8" />
              <circle
                className="timer-progress"
                cx="100"
                cy="100"
                r="90"
                fill="none"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - progressPercentage / 100)}`}
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div className="timer-time">{formatTime(remainingSeconds)}</div>
          </div>
        </div>
      )}

      <div className={`timer-controls ${isCompact ? 'compact' : ''}`}>
        {timerState === 'idle' && (
          <button type="button" className="timer-button start" onClick={handleStart}>
            开始
          </button>
        )}
        {timerState === 'running' && (
          <button type="button" className="timer-button pause" onClick={handlePause}>
            暂停
          </button>
        )}
        {timerState === 'paused' && (
          <>
            <button type="button" className="timer-button resume" onClick={handleStart}>
              继续
            </button>
            <button type="button" className="timer-button reset" onClick={handleReset}>
              重置
            </button>
          </>
        )}
      </div>

      {isCompact ? (
        <div className="timer-meta">
          <span>{SESSION_HINT[sessionType]}</span>
        </div>
      ) : showSummary ? (
        <div className="timer-info">
          <p className="timer-hint">{SESSION_HINT[sessionType]}</p>
          <p className="timer-stats">本轮已完成专注 {focusCount} 次</p>
        </div>
      ) : null}
    </div>
  )
}
