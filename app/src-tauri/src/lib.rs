use tauri::Manager;

mod commands;
mod state;
mod storage;
mod windows;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  println!("=== Tauri 应用启动 ===");

  tauri::Builder::default()
    .setup(|app| {
      println!("=== Setup 开始 ===");

      if cfg!(debug_assertions) {
        println!("调试模式: 启用日志插件");
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      println!("加载通知插件...");
      app
        .handle()
        .plugin(tauri_plugin_notification::init())?;

      println!("初始化存储...");
      let store = storage::FileStore::initialize(&app.handle())?;
      app.manage(state::AppState::new(store));

      println!("初始化窗口...");
      windows::init(app)?;
      println!("===  系统托盘初始化 ===");
      tray::init(&app.handle())?;
      println!("===  系统托盘完成 ===");

      println!("=== Setup 完成 ===");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::todo::list_todos,
      commands::todo::create_todo,
      commands::todo::update_todo,
      commands::todo::delete_todo,
      commands::todo::toggle_complete,
      commands::pomodoro::get_pomodoro_config,
      commands::pomodoro::save_pomodoro_config,
      commands::pomodoro::append_pomodoro_session,
      commands::pomodoro::list_pomodoro_sessions,
      commands::settings::get_settings,
      commands::settings::save_settings,
      commands::settings::record_window_state
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");

  println!("=== Tauri 应用退出 ===");
}
