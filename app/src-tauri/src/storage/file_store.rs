use std::{
  fs,
  path::{Path, PathBuf},
  sync::Arc,
};

use chrono::Local;
use parking_lot::Mutex;
use serde::{de::DeserializeOwned, Serialize};
use tauri::{AppHandle, Manager};

use super::{PomodoroConfig, PomodoroSession, StorageError, TodoItem, UserSettings};

const TODOS_FILE: &str = "todos.json";
const POMODORO_FILE: &str = "pomodoro.json";
const SETTINGS_FILE: &str = "settings.json";
const SESSIONS_FILE: &str = "sessions.json";

pub struct FileStore {
  data_dir: Arc<PathBuf>,
  backup_dir: Arc<PathBuf>,
  guard: Mutex<()>,
}

impl FileStore {
  pub fn initialize(app: &AppHandle) -> Result<Self, StorageError> {
    let base_dir = app
      .path()
      .app_data_dir()
      .map_err(|_| StorageError::ResolveDir)?;
    let data_dir = base_dir.join("data");
    let backup_dir = data_dir.join("backups");

    fs::create_dir_all(&data_dir)?;
    fs::create_dir_all(&backup_dir)?;

    let store = Self {
      data_dir: Arc::new(data_dir),
      backup_dir: Arc::new(backup_dir),
      guard: Mutex::new(()),
    };

    store.bootstrap_files()?;
    Ok(store)
  }

  pub fn load_todos(&self) -> Result<Vec<TodoItem>, StorageError> {
    self.read_json::<Vec<TodoItem>>(TODOS_FILE)
  }

  pub fn save_todos(&self, todos: &[TodoItem]) -> Result<(), StorageError> {
    self.write_json(TODOS_FILE, todos)
  }

  pub fn load_pomodoro_config(&self) -> Result<PomodoroConfig, StorageError> {
    self.read_json::<PomodoroConfig>(POMODORO_FILE)
  }

  pub fn save_pomodoro_config(&self, config: &PomodoroConfig) -> Result<(), StorageError> {
    self.write_json(POMODORO_FILE, config)
  }

  pub fn load_sessions(&self) -> Result<Vec<PomodoroSession>, StorageError> {
    self.read_json::<Vec<PomodoroSession>>(SESSIONS_FILE)
  }

  pub fn save_sessions(&self, sessions: &[PomodoroSession]) -> Result<(), StorageError> {
    self.write_json(SESSIONS_FILE, sessions)
  }

  pub fn load_settings(&self) -> Result<UserSettings, StorageError> {
    self.read_json::<UserSettings>(SETTINGS_FILE)
  }

  pub fn save_settings(&self, settings: &UserSettings) -> Result<(), StorageError> {
    self.write_json(SETTINGS_FILE, settings)
  }

  fn bootstrap_files(&self) -> Result<(), StorageError> {
    if !self.path_for(TODOS_FILE).exists() {
      self.write_json(TODOS_FILE, &Vec::<TodoItem>::new())?;
    }
    if !self.path_for(SESSIONS_FILE).exists() {
      self.write_json(SESSIONS_FILE, &Vec::<PomodoroSession>::new())?;
    }
    if !self.path_for(POMODORO_FILE).exists() {
      self.write_json(POMODORO_FILE, &PomodoroConfig::default())?;
    }
    if !self.path_for(SETTINGS_FILE).exists() {
      self.write_json(SETTINGS_FILE, &UserSettings::default())?;
    }
    Ok(())
  }

  fn read_json<T>(&self, name: &str) -> Result<T, StorageError>
  where
    T: DeserializeOwned + Default,
  {
    let _lock = self.guard.lock();
    let path = self.path_for(name);
    if !path.exists() {
      return Ok(T::default());
    }
    let content = fs::read_to_string(&path)?;
    if content.trim().is_empty() {
      return Ok(T::default());
    }
    Ok(serde_json::from_str::<T>(&content)?)
  }

  fn write_json<T>(&self, name: &str, data: &T) -> Result<(), StorageError>
  where
    T: Serialize + ?Sized,
  {
    let _lock = self.guard.lock();
    let path = self.path_for(name);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent)?;
    }

    self.maybe_backup(&path, name)?;

    let payload = serde_json::to_vec_pretty(data)?;
    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, &payload)?;
    if path.exists() {
      fs::remove_file(&path)?;
    }
    fs::rename(&temp_path, &path)?;
    Ok(())
  }

  fn maybe_backup(&self, path: &Path, name: &str) -> Result<(), StorageError> {
    if !path.exists() {
      return Ok(());
    }

    let today = Local::now().format("%Y%m%d").to_string();
    let backup_name = format!("{}_{}", today, name);
    let backup_path = self.backup_dir.join(backup_name);

    if backup_path.exists() {
      return Ok(());
    }

    if let Some(parent) = backup_path.parent() {
      fs::create_dir_all(parent)?;
    }

    fs::copy(path, backup_path)?;
    Ok(())
  }

  fn path_for(&self, name: &str) -> PathBuf {
    self.data_dir.join(name)
  }
}
