use tauri::{
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
  AppHandle, Manager,
};

pub fn init(app: &AppHandle) -> tauri::Result<()> {
  let show_item = MenuItemBuilder::new("Show Main Window")
    .id("show-main")
    .build(app)?;

  let exit_item = MenuItemBuilder::new("Exit")
    .id("exit-app")
    .build(app)?;

  let menu = MenuBuilder::new(app)
    .item(&show_item)
    .separator()
    .item(&exit_item)
    .build()?;

  let mut builder = TrayIconBuilder::new()
    .menu(&menu)
    .tooltip("FocusTodo");

  if let Some(icon) = app.default_window_icon() {
    builder = builder.icon(icon.clone());
  }

  let app_handle = app.clone();

  builder
    .on_tray_icon_event(move |tray, event| {
      if matches!(
        event,
        TrayIconEvent::Click {
          button: MouseButton::Left,
          ..
        } | TrayIconEvent::DoubleClick { .. }
      ) {
        if let Some(main) = tray.app_handle().get_webview_window("main") {
          let _ = main.show();
          let _ = main.set_focus();
        }
      }
    })
    .on_menu_event(move |tray, event| {
      let app = tray.app_handle();
      match event.id.as_ref() {
        "show-main" => {
          if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
          }
        }
        "exit-app" => app.exit(0),
        _ => {}
      }
    })
    .build(&app_handle)?;

  Ok(())
}

