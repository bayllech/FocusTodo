import { usePomodoroStore } from '../stores/pomodoroStore'

export const FloatingPomodoroDisplay = () => {
  const config = usePomodoroStore((state) => state.config)

  // 悬浮窗仅展示配置摘要，不提供交互控制
  // 详细的计时逻辑由主面板内部处理

  return (
    <div className="floating-pomodoro">
      <div className="pomodoro-config-mini">
        <div className="config-item">
          <span className="label">专注</span>
          <span className="value">{config.focusMinutes} 分钟</span>
        </div>
        <div className="config-item">
          <span className="label">短休</span>
          <span className="value">{config.shortBreakMinutes} 分钟</span>
        </div>
        <div className="config-item">
          <span className="label">长休</span>
          <span className="value">{config.longBreakMinutes} 分钟</span>
        </div>
      </div>
      <p className="pomodoro-hint">在主面板中调整番茄钟设置</p>
    </div>
  )
}

