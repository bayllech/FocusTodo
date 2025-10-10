use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TodoPriority {
  Low,
  Medium,
  High,
}

impl Default for TodoPriority {
  fn default() -> Self {
    Self::Medium
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoItem {
  pub id: String,
  pub title: String,
  #[serde(default)]
  pub detail: Option<String>,
  #[serde(default)]
  pub priority: TodoPriority,
  #[serde(default)]
  pub tags: Vec<String>,
  #[serde(default)]
  pub planned_at: Option<String>,
  #[serde(default)]
  pub due_at: Option<String>,
  #[serde(default)]
  pub completed: bool,
  #[serde(default)]
  pub completed_at: Option<String>,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoDraft {
  pub title: String,
  #[serde(default)]
  pub detail: Option<String>,
  #[serde(default)]
  pub priority: TodoPriority,
  #[serde(default)]
  pub tags: Vec<String>,
  #[serde(default)]
  pub planned_at: Option<String>,
  #[serde(default)]
  pub due_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PomodoroSessionKind {
  Focus,
  ShortBreak,
  LongBreak,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroConfig {
  pub focus_minutes: u32,
  pub short_break_minutes: u32,
  pub long_break_minutes: u32,
  pub long_break_interval: u32,
  pub auto_start_next: bool,
}

impl Default for PomodoroConfig {
  fn default() -> Self {
    Self {
      focus_minutes: 25,
      short_break_minutes: 5,
      long_break_minutes: 15,
      long_break_interval: 4,
      auto_start_next: false,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroSession {
  pub id: String,
  #[serde(default)]
  pub todo_id: Option<String>,
  pub start_at: String,
  #[serde(default)]
  pub end_at: Option<String>,
  #[serde(default)]
  pub duration_minutes: Option<u32>,
  pub r#type: PomodoroSessionKind,
  pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroSessionDraft {
  #[serde(default)]
  pub todo_id: Option<String>,
  pub start_at: String,
  #[serde(default)]
  pub end_at: Option<String>,
  #[serde(default)]
  pub duration_minutes: Option<u32>,
  pub r#type: PomodoroSessionKind,
  pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ThemeMode {
  System,
  Light,
  Dark,
  Mac,
}

impl Default for ThemeMode {
  fn default() -> Self {
    Self::Mac
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HotkeySetting {
  #[serde(default)]
  pub toggle_floating: Option<String>,
  #[serde(default)]
  pub start_or_pause_timer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowGeometry {
  #[serde(default)]
  pub x: Option<i32>,
  #[serde(default)]
  pub y: Option<i32>,
  #[serde(default)]
  pub width: Option<u32>,
  #[serde(default)]
  pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
  #[serde(default)]
  pub main: WindowGeometry,
  #[serde(default)]
  pub floating: WindowGeometry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
  pub theme: ThemeMode,
  pub follow_system_theme: bool,
  pub always_on_top: bool,
  pub snap_edge: bool,
  #[serde(default = "default_floating_opacity")]
  pub floating_opacity: f32,
  #[serde(default)]
  pub show_completed_in_floating: bool,
  #[serde(default)]
  pub hotkeys: HotkeySetting,
  #[serde(default)]
  pub window_state: WindowState,
}

fn default_floating_opacity() -> f32 {
  0.95
}

impl Default for UserSettings {
  fn default() -> Self {
    Self {
      theme: ThemeMode::Mac,
      follow_system_theme: true,
      always_on_top: true,
      snap_edge: true,
      floating_opacity: 0.95,
      show_completed_in_floating: false,
      hotkeys: HotkeySetting::default(),
      window_state: WindowState::default(),
    }
  }
}
