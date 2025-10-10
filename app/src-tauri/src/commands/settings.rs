use tauri::State;

use crate::{
  state::AppState,
  storage::{StorageError, UserSettings, WindowGeometry},
};

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<UserSettings, String> {
  state
    .store()
    .load_settings()
    .map_err(to_string)
}

#[tauri::command]
pub fn save_settings(
  state: State<AppState>,
  settings: UserSettings,
) -> Result<UserSettings, String> {
  state
    .store()
    .save_settings(&settings)
    .map_err(to_string)?;
  Ok(settings)
}

#[tauri::command]
pub fn record_window_state(
  state: State<AppState>,
  label: String,
  geometry: WindowGeometry,
) -> Result<UserSettings, String> {
  let mut settings = state.store().load_settings().map_err(to_string)?;
  match label.as_str() {
    "main" => settings.window_state.main = geometry,
    "floating" => settings.window_state.floating = geometry,
    other => {
      return Err(
        StorageError::validation(format!("未知窗口标签: {other}")).to_string()
      )
    }
  }
  state.store().save_settings(&settings).map_err(to_string)?;
  Ok(settings)
}

fn to_string(error: StorageError) -> String {
  error.to_string()
}
