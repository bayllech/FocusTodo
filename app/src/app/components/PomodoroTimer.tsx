import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

import { usePomodoroStore } from '../stores/pomodoroStore'
import type { PomodoroSessionKind } from '../types'

// 番茄时钟状态
type TimerState = 'idle' | 'running' | 'paused'

export const PomodoroTimer = () => {
  const config = usePomodoroStore((state) => state.config)
  const addSession = usePomodoroStore((state) => state.addSession)
  const loadSessions = usePomodoroStore((state) => state.loadSessions)

  // 状态管理
  const [state, setState] = useState<TimerState>('idle')
  const [sessionType, setSessionType] = useState<PomodoroSessionKind>('focus')
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null)
  const [focusCount, setFocusCount] = useState(0)

  // 初始化剩余时间
  useEffect(() => {
    if (state === 'idle') {
      const minutes =
        sessionType === 'focus'
          ? config.focusMinutes
          : sessionType === 'shortBreak'
            ? config.shortBreakMinutes
            : config.longBreakMinutes
      setRemainingSeconds(minutes * 60)
    }
  }, [state, sessionType, config])

  // 倒计时逻辑
  useEffect(() => {
    if (state !== 'running') return

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // 番茄完成
          void handleComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [state])

  // 完成一个番茄
  const handleComplete = async () => {
    setState('idle')

    if (!sessionStartTime) return

    try {
      // 保存完成的番茄记录
      await addSession({
        type: sessionType,
        startAt: sessionStartTime,
        endAt: dayjs().toISOString(),
        durationMinutes:
          sessionType === 'focus'
            ? config.focusMinutes
            : sessionType === 'shortBreak'
              ? config.shortBreakMinutes
              : config.longBreakMinutes,
        completed: true,
      })

      // 刷新今日记录
      await loadSessions(dayjs().format('YYYY-MM-DD'))

      // 自动切换到下一阶段
      if (config.autoStartNext) {
        if (sessionType === 'focus') {
          const newFocusCount = focusCount + 1
          setFocusCount(newFocusCount)

          // 判断是长休还是短休
          if (newFocusCount % config.longBreakInterval === 0) {
            setSessionType('longBreak')
          } else {
            setSessionType('shortBreak')
          }
        } else {
          setSessionType('focus')
        }
      }
    } catch (error) {
      console.error('保存番茄记录失败', error)
    }

    setSessionStartTime(null)
  }

  // 开始/继续计时
  const handleStart = () => {
    if (state === 'idle') {
      setSessionStartTime(dayjs().toISOString())
    }
    setState('running')
  }

  // 暂停计时
  const handlePause = () => {
    setState('paused')
  }

  // 重置计时
  const handleReset = () => {
    setState('idle')
    setSessionStartTime(null)
    const minutes =
      sessionType === 'focus'
        ? config.focusMinutes
        : sessionType === 'shortBreak'
          ? config.shortBreakMinutes
          : config.longBreakMinutes
    setRemainingSeconds(minutes * 60)
  }

  // 手动切换阶段
  const handleSwitchType = (type: PomodoroSessionKind) => {
    if (state !== 'idle') {
      if (!confirm('切换阶段将重置当前计时,确定要切换吗?')) {
        return
      }
    }
    setSessionType(type)
    handleReset()
  }

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 进度百分比
  const progressPercentage = (() => {
    const total =
      (sessionType === 'focus'
        ? config.focusMinutes
        : sessionType === 'shortBreak'
          ? config.shortBreakMinutes
          : config.longBreakMinutes) * 60
    return ((total - remainingSeconds) / total) * 100
  })()

  return (
    <div className="pomodoro-timer">
      <div className="timer-header">
        <div className="timer-type-selector">
          <button
            type="button"
            className={`type-button ${sessionType === 'focus' ? 'active' : ''}`}
            onClick={() => handleSwitchType('focus')}
            disabled={state === 'running'}
          >
            专注
          </button>
          <button
            type="button"
            className={`type-button ${sessionType === 'shortBreak' ? 'active' : ''}`}
            onClick={() => handleSwitchType('shortBreak')}
            disabled={state === 'running'}
          >
            短休
          </button>
          <button
            type="button"
            className={`type-button ${sessionType === 'longBreak' ? 'active' : ''}`}
            onClick={() => handleSwitchType('longBreak')}
            disabled={state === 'running'}
          >
            长休
          </button>
        </div>
      </div>

      <div className="timer-display">
        <div className="timer-circle">
          <svg viewBox="0 0 200 200">
            <circle
              className="timer-track"
              cx="100"
              cy="100"
              r="90"
              fill="none"
              strokeWidth="8"
            />
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

      <div className="timer-controls">
        {state === 'idle' && (
          <button type="button" className="timer-button start" onClick={handleStart}>
            开始
          </button>
        )}
        {state === 'running' && (
          <button type="button" className="timer-button pause" onClick={handlePause}>
            暂停
          </button>
        )}
        {state === 'paused' && (
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

      <div className="timer-info">
        <p className="timer-hint">
          {sessionType === 'focus'
            ? '保持专注,完成你的任务'
            : sessionType === 'shortBreak'
              ? '短暂休息,放松一下'
              : '长时间休息,好好放松'}
        </p>
        <p className="timer-stats">今日完成专注: {focusCount} 个番茄</p>
      </div>
    </div>
  )
}
