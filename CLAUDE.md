# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 **Tauri 2 + React 19 + TypeScript** 的跨平台桌面待办与番茄钟应用,支持 Windows 和 macOS。核心特征为常驻悬浮小窗、Mac 风格视觉、本地 JSON 数据存储。

技术栈:
- **前端**: React 19, Zustand(状态管理), Vite 7, TypeScript 5.9
- **后端**: Rust (Tauri 2.8), serde (序列化), parking_lot (线程安全)
- **构建工具**: Vite + Tauri CLI
- **通知系统**: tauri-plugin-notification

## 常用命令

### 开发环境

```bash
# 前端开发服务器 (端口 5173)
cd app
npm run dev

# Tauri 开发模式 (同时启动前端和 Rust 后端)
cd app
npm run tauri:dev

# 或直接使用 Tauri CLI
cd app
npm run tauri dev
```

### 构建与打包

```bash
# 构建前端资源 (输出到 app/dist)
cd app
npm run build

# 构建 Tauri 应用 (生成 Windows MSI 或 macOS DMG)
cd app
npm run tauri:build

# 仅编译 Rust 后端 (调试模式)
cd app/src-tauri
cargo build

# 仅编译 Rust 后端 (发布模式)
cd app/src-tauri
cargo build --release
```

### 测试与开发

```bash
# TypeScript 类型检查
cd app
npx tsc --noEmit

# 查看 Tauri 应用日志 (开发模式会自动打印到控制台)
# 日志位于应用启动的终端窗口

# Cargo 测试 (如果有单元测试)
cd app/src-tauri
cargo test

# Cargo 检查 (快速语法检查,不生成二进制)
cd app/src-tauri
cargo check
```

### 图标生成

```bash
# 根据源图标生成多平台图标
cd app
npm run tauri:icon [source-icon-path]
```

## 核心架构

### 双窗口体系

应用包含两个独立窗口,在 `tauri.conf.json` 中定义:

1. **主窗口** (`main`):
   - 完整任务管理、番茄钟配置、设置面板
   - 800×600px,可调整大小,居中显示
   - 标准窗口装饰(标题栏、边框)

2. **悬浮小窗** (`floating`):
   - 实时显示番茄钟状态和核心任务列表
   - 360×480px,最小尺寸 320×360px
   - 无边框、透明、可置顶、隐藏任务栏图标
   - 支持拖拽、吸附边缘

窗口初始化逻辑位于 `app/src-tauri/src/windows.rs`,托盘菜单位于 `app/src-tauri/src/tray.rs`。

### 前端架构 (React + Zustand)

状态管理分为三个独立 Store (位于 `app/src/app/stores/`):

- **todoStore.ts**: 任务列表 CRUD、加载状态、错误处理
- **pomodoroStore.ts**: 番茄钟配置、Session 记录、倒计时状态
- **settingsStore.ts**: 主题、窗口行为、快捷键、窗口几何状态

所有 Tauri 命令调用封装在 `app/src/app/services/api.ts`,通过 `@tauri-apps/api/core` 的 `invoke()` 与后端通信。

### 后端架构 (Rust + Tauri)

模块结构 (位于 `app/src-tauri/src/`):

```
lib.rs              # 应用入口,插件初始化,命令注册
├── commands/       # Tauri 命令实现
│   ├── todo.rs     # list_todos, create_todo, update_todo, delete_todo, toggle_complete
│   ├── pomodoro.rs # get_pomodoro_config, save_pomodoro_config, append_pomodoro_session, list_pomodoro_sessions
│   └── settings.rs # get_settings, save_settings, record_window_state
├── storage/        # 数据持久化层
│   ├── file_store.rs  # FileStore 实现:原子写入、自动备份、并发安全
│   ├── models.rs      # 数据模型:TodoItem, PomodoroConfig, UserSettings 等
│   └── error.rs       # StorageError 错误类型
├── state.rs        # AppState 全局状态管理 (包含 FileStore)
├── windows.rs      # 窗口生命周期管理
└── tray.rs         # 系统托盘菜单
```

**关键设计要点**:

1. **并发安全**: `FileStore` 使用 `parking_lot::Mutex` 确保文件读写原子性,避免并发损坏
2. **原子写入**: 先写入临时文件 `.tmp`,再重命名替换目标文件,防止写入中断导致数据损坏
3. **自动备份**: 每次写入前检查是否已生成当日备份 (`YYYYMMDD_文件名.json`),如未生成则自动备份原文件到 `data/backups/`

### 数据存储

本地 JSON 文件存储于用户应用数据目录 (`~/.local/share/com.tauri.dev/` 或 `%APPDATA%\com.tauri.dev\` 或 macOS 对应路径):

```
data/
├── todos.json       # 任务列表
├── pomodoro.json    # 番茄钟配置
├── sessions.json    # 番茄钟 Session 历史记录
├── settings.json    # 用户设置
└── backups/         # 每日自动备份
    ├── 20250110_todos.json
    ├── 20250110_sessions.json
    └── ...
```

### 类型系统对齐

前端 TypeScript 类型 (`app/src/app/types/index.ts`) 必须与后端 Rust 类型 (`app/src-tauri/src/storage/models.rs`) 保持一致:

- Rust `#[serde(rename_all = "camelCase")]` 确保 JSON 序列化为驼峰式
- 前端类型定义需手动同步,修改 Rust 模型后务必更新前端类型
- 优先级枚举: `'low' | 'medium' | 'high'` (前端) ↔ `TodoPriority` (Rust)
- 番茄钟类型: `'focus' | 'shortBreak' | 'longBreak'` (前端) ↔ `PomodoroSessionKind` (Rust)

## 关键业务流程

### 任务管理流程

```
用户操作 → 前端 Store 方法 → api.ts 封装的 invoke() → Rust Command
→ FileStore 加载 todos.json → 数据修改 → FileStore 原子写入 + 自动备份
→ 返回结果 → 前端 Store 更新状态 → UI 重新渲染
```

### 番茄钟计时流程

1. 前端 `pomodoroStore.ts` 维护倒计时状态 (`remainingSeconds`)
2. 使用 `setInterval` 每秒递减,误差需小于 0.5 秒
3. 阶段结束时:
   - 触发系统通知 (`tauri-plugin-notification`)
   - 播放提示音 (如已实现)
   - 创建 `PomodoroSession` 记录并调用 `append_pomodoro_session` 存储
   - 根据 `autoStartNext` 配置决定是否自动进入下一阶段

### 窗口状态同步

- 前端通过 `useWindowStateSync` Hook 监听窗口位置/尺寸变化
- 调用 `record_window_state` 命令将几何状态持久化到 `settings.json`
- 应用重启时从 `settings.json` 恢复窗口位置和尺寸

## 开发注意事项

### Rust 端

1. **修改 Tauri 命令**: 在 `commands/` 模块中新增函数后,必须在 `lib.rs` 的 `invoke_handler!` 宏中注册
2. **修改数据模型**: 同步更新 `storage/models.rs` 和前端 `types/index.ts`,确保字段名和类型一致
3. **错误处理**: 命令返回类型使用 `Result<T, String>`,`StorageError` 自动转换为字符串返回前端
4. **日志输出**: 使用 `println!` 或 `log` crate,开发模式日志会打印到控制台

### 前端

1. **类型安全**: 所有 Tauri 命令调用必须通过 `api.ts` 封装,避免直接使用 `invoke()`
2. **状态管理**: 新增全局状态时在 `stores/` 中创建独立 Store,避免单一 Store 过于臃肿
3. **窗口通信**: 主窗口和悬浮小窗共享相同的 Zustand Store,状态自动同步
4. **主题系统**: 根据 `settingsStore` 的 `theme` 和 `followSystemTheme` 动态切换 CSS 类名

### 跨平台兼容性

- 窗口透明和磨砂效果 (`transparent: true`, CSS `backdrop-filter`) 在不同系统上表现可能不一致,需实际测试
- 文件路径使用 `std::path::PathBuf` 确保跨平台兼容,避免硬编码路径分隔符
- 系统通知在 Windows/macOS 上的样式和行为存在差异,测试时需验证两个平台

## MVP 功能范围

参考 `docs/MVP.md` 了解完整需求文档。MVP 阶段包含:

- 任务管理: 新建、编辑、删除、完成状态切换、标签筛选、关键字搜索
- 番茄钟: 可配置专注/休息时长、倒计时、通知提醒、Session 记录
- 双窗口: 主窗口 + 悬浮小窗,支持拖拽、置顶、吸附
- 基础设置: 主题切换、窗口行为、快捷键、数据导出

**不包含**: 多人协作、云同步、高级统计、移动端

## 风险和改进点

- **并发写入**: 当前使用 `Mutex` + 临时文件保证原子性,如遇高频写入可考虑引入写入队列
- **计时精度**: 前端 `setInterval` 可能因系统休眠/锁屏不准确,可改为 Rust 后台计时 + 前端轮询
- **备份清理**: 当前仅生成备份不清理旧备份,可添加定期清理 N 天前的备份逻辑
- **类型同步**: 手动同步前后端类型易出错,可考虑使用 `typescript-type-def` 或类似工具自动生成

## 代码规范

- Rust: 遵循 `rustfmt` 和 `clippy` 标准,使用 `snake_case` 命名
- TypeScript: 使用 ESLint + Prettier,遵循 Airbnb 风格指南,函数和变量使用 `camelCase`
- 组件: React 组件使用 `PascalCase`,文件名与组件名一致 (如 `TodoModal.tsx`)
- 注释: 优先使用中文注释,关键业务逻辑必须注释
