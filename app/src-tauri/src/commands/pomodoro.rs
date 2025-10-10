use chrono::{DateTime, Duration, NaiveDate};
use tauri::State;
use uuid::Uuid;

use crate::{
  state::AppState,
  storage::{PomodoroConfig, PomodoroSession, PomodoroSessionDraft, StorageError},
};

#[tauri::command]
pub fn get_pomodoro_config(state: State<AppState>) -> Result<PomodoroConfig, String> {
  state
    .store()
    .load_pomodoro_config()
    .map_err(to_string)
}

#[tauri::command]
pub fn save_pomodoro_config(
  state: State<AppState>,
  config: PomodoroConfig,
) -> Result<PomodoroConfig, String> {
  validate_config(&config).map_err(to_string)?;
  state
    .store()
    .save_pomodoro_config(&config)
    .map_err(to_string)?;
  Ok(config)
}

#[tauri::command]
pub fn append_pomodoro_session(
  state: State<AppState>,
  draft: PomodoroSessionDraft,
) -> Result<PomodoroSession, String> {
  let session = build_session(draft)?;
  let mut sessions = state.store().load_sessions().map_err(to_string)?;
  sessions.push(session.clone());
  state.store().save_sessions(&sessions).map_err(to_string)?;
  Ok(session)
}

#[tauri::command]
pub fn list_pomodoro_sessions(
  state: State<AppState>,
  date: Option<String>,
) -> Result<Vec<PomodoroSession>, String> {
  let sessions = state.store().load_sessions().map_err(to_string)?;
  if let Some(date_str) = date {
    if let Ok(target_date) = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
      let filtered = sessions
        .into_iter()
        .filter(|session| match DateTime::parse_from_rfc3339(&session.start_at) {
          Ok(dt) => dt.date_naive() == target_date,
          Err(_) => false,
        })
        .collect();
      return Ok(filtered);
    }
  }
  Ok(sessions)
}

fn validate_config(config: &PomodoroConfig) -> Result<(), StorageError> {
  if config.focus_minutes == 0
    || config.short_break_minutes == 0
    || config.long_break_minutes == 0
    || config.long_break_interval == 0
  {
    return Err(StorageError::validation("番茄钟配置参数必须大于 0"));
  }
  if config.focus_minutes > 180 {
    return Err(StorageError::validation("专注时长不建议超过 180 分钟"));
  }
  Ok(())
}

fn build_session(draft: PomodoroSessionDraft) -> Result<PomodoroSession, String> {
  let start = DateTime::parse_from_rfc3339(&draft.start_at)
    .map_err(|_| StorageError::validation("开始时间格式错误").to_string())?;
  let duration = match (&draft.end_at, draft.duration_minutes) {
    (Some(_), Some(explicit)) if explicit > 0 => Some(explicit),
    (Some(end_str), _) => {
      let end = DateTime::parse_from_rfc3339(end_str)
        .map_err(|_| StorageError::validation("结束时间格式错误").to_string())?;
      let diff = end - start;
      Some(duration_minutes(diff))
    }
    _ => draft.duration_minutes,
  };

  Ok(PomodoroSession {
    id: Uuid::new_v4().to_string(),
    todo_id: draft.todo_id,
    start_at: draft.start_at,
    end_at: draft.end_at,
    duration_minutes: duration,
    r#type: draft.r#type,
    completed: draft.completed,
  })
}

fn duration_minutes(duration: Duration) -> u32 {
  let mins = duration.num_minutes();
  if mins <= 0 {
    0
  } else {
    mins as u32
  }
}

fn to_string(error: StorageError) -> String {
  error.to_string()
}
