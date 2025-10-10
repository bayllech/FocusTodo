use tauri::{App, LogicalPosition, LogicalSize, Manager, WebviewWindow, WindowEvent};

use crate::{state::AppState, storage::WindowGeometry};

pub fn init(app: &App) -> tauri::Result<()> {
  println!("=== 窗口初始化开始 ===");

  let settings = app
    .state::<AppState>()
    .store()
    .load_settings()
    .unwrap_or_default();

  println!("配置加载完成: {:?}", settings.window_state);

  if let Some(main_window) = app.get_webview_window("main") {
    println!("找到主窗口: {}", main_window.label());

    // 确保窗口先显示，避免在屏幕外无法看到
    println!("尝试显示主窗口...");
    match main_window.show() {
      Ok(_) => println!("主窗口显示成功"),
      Err(e) => println!("主窗口显示失败: {}", e),
    }

    // 应用保存的窗口几何信息（如果有的话）
    if let Err(e) = apply_geometry(&main_window, &settings.window_state.main) {
      println!("无法应用主窗口几何信息: {}", e);
      // 如果应用几何信息失败，尝试居中显示
      match main_window.center() {
        Ok(_) => println!("主窗口居中成功"),
        Err(e) => println!("主窗口居中失败: {}", e),
      }
    } else {
      println!("主窗口几何信息应用成功");
    }

    // 额外检查窗口状态
    if let Ok(visible) = main_window.is_visible() {
      println!("主窗口可见性: {}", visible);
    }

    let main_window_for_event = main_window.clone();
    main_window.on_window_event(move |event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        println!("检测到主窗口关闭请求，转为隐藏主窗");
        api.prevent_close();


        if let Err(err) = main_window_for_event.hide() {
          println!("警告: 隐藏主窗口失败: {}", err);
        }
      }
    });
  } else {
    println!("警告: 未找到主窗口!");
  }



  if let Some(floating_window) = app.get_webview_window("floating") {
    println!("找到悬浮窗: {}", floating_window.label());
    if let Err(e) = apply_geometry(&floating_window, &settings.window_state.floating) {
      println!("警告: 无法应用悬浮窗尺寸信息: {}", e);
    }
    floating_window.hide()?; // 启动时默认隐藏，前端可手动唤起
    println!("悬浮窗初始化完成");
  } else {
    println!("警告: 未找到悬浮窗!");
  }

  println!("=== 窗口初始化完成 ===");
  Ok(())
}

fn apply_geometry(window: &WebviewWindow, geometry: &WindowGeometry) -> tauri::Result<()> {
  // 验证窗口位置是否有效
  if let (Some(x), Some(y)) = (geometry.x, geometry.y) {
    // Windows 使用 (-32000, -32000) 表示最小化窗口
    // 我们需要拒绝这种无效坐标，以及其他明显超出屏幕范围的坐标
    const MIN_VALID_COORD: i32 = -10000;
    const MAX_VALID_COORD: i32 = 10000;

    if x < MIN_VALID_COORD || x > MAX_VALID_COORD || y < MIN_VALID_COORD || y > MAX_VALID_COORD {
      println!(
        "警告: 窗口位置无效 ({}, {}), 跳过位置设置",
        x, y
      );
      // 返回一个错误，让调用方处理（居中窗口）
      return Err(tauri::Error::InvalidWindowHandle);
    }

    println!("应用窗口位置: ({}, {})", x, y);
    window.set_position(LogicalPosition::new(x as f64, y as f64))?;
  }

  // 验证窗口大小是否合理
  if let (Some(width), Some(height)) = (geometry.width, geometry.height) {
    // 确保窗口大小合理（最小 100x100，最大 10000x10000）
    const MIN_SIZE: u32 = 100;
    const MAX_SIZE: u32 = 10000;

    if width < MIN_SIZE || width > MAX_SIZE || height < MIN_SIZE || height > MAX_SIZE {
      println!(
        "警告: 窗口尺寸异常 ({}x{}), 跳过尺寸设置",
        width, height
      );
      return Ok(());
    }

    println!("应用窗口尺寸: {}x{}", width, height);
    window.set_size(LogicalSize::new(width as f64, height as f64))?;
  }

  Ok(())
}
