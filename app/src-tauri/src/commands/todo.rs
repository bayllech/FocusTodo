use chrono::Utc;
use tauri::State;
use uuid::Uuid;

use crate::{
  state::AppState,
  storage::{StorageError, TodoDraft, TodoItem},
};

#[tauri::command]
pub fn list_todos(state: State<AppState>) -> Result<Vec<TodoItem>, String> {
  state
    .store()
    .load_todos()
    .map_err(to_string)
}

#[tauri::command]
pub fn create_todo(state: State<AppState>, draft: TodoDraft) -> Result<TodoItem, String> {
  let mut todos = state.store().load_todos().map_err(to_string)?;
  let now = Utc::now().to_rfc3339();
  let todo = TodoItem {
    id: Uuid::new_v4().to_string(),
    title: draft.title,
    detail: draft.detail,
    priority: draft.priority,
    tags: draft.tags,
    planned_at: draft.planned_at,
    due_at: draft.due_at,
    completed: false,
    completed_at: None,
    created_at: now.clone(),
    updated_at: now,
  };
  todos.push(todo.clone());
  state.store().save_todos(&todos).map_err(to_string)?;
  Ok(todo)
}

#[tauri::command]
pub fn update_todo(state: State<AppState>, updated: TodoItem) -> Result<TodoItem, String> {
  let mut todos = state.store().load_todos().map_err(to_string)?;
  let now = Utc::now().to_rfc3339();

  let mut found = false;
  for todo in &mut todos {
    if todo.id == updated.id {
      *todo = TodoItem {
        updated_at: now.clone(),
        ..updated.clone()
      };
      found = true;
      break;
    }
  }

  if !found {
    return Err(StorageError::NotFound("todo").to_string());
  }

  state.store().save_todos(&todos).map_err(to_string)?;

  todos
    .into_iter()
    .find(|item| item.id == updated.id)
    .ok_or_else(|| StorageError::NotFound("todo").to_string())
}

#[tauri::command]
pub fn delete_todo(state: State<AppState>, id: String) -> Result<(), String> {
  let mut todos = state.store().load_todos().map_err(to_string)?;
  let initial_len = todos.len();
  todos.retain(|item| item.id != id);
  if todos.len() == initial_len {
    return Err(StorageError::NotFound("todo").to_string());
  }
  state.store().save_todos(&todos).map_err(to_string)
}

#[tauri::command]
pub fn toggle_complete(
  state: State<AppState>,
  id: String,
  completed: bool,
) -> Result<TodoItem, String> {
  let mut todos = state.store().load_todos().map_err(to_string)?;
  let now = Utc::now().to_rfc3339();
  let mut result = None;

  for todo in &mut todos {
    if todo.id == id {
      todo.completed = completed;
      todo.completed_at = if completed { Some(now.clone()) } else { None };
      todo.updated_at = now.clone();
      result = Some(todo.clone());
      break;
    }
  }

  if result.is_none() {
    return Err(StorageError::NotFound("todo").to_string());
  }

  state.store().save_todos(&todos).map_err(to_string)?;
  Ok(result.unwrap())
}

fn to_string(error: StorageError) -> String {
  error.to_string()
}
