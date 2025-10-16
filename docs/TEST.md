# 本地测试与验证指南

## 概述

在提交版本发布到 GitHub 之前，建议进行本地构建验证，确保：
- ✅ 代码能正常编译
- ✅ 生成的安装包可用
- ✅ 应用功能正常
- ✅ 校验和正确

本指南提供了完整的本地测试流程。

## 环境准备

### 系统要求

#### Windows
- Windows 7 SP1 或更高版本
- Visual Studio 2022 构建工具（MSVC 工具链）
- 或 Windows 11 SDK

#### macOS
- macOS 11.0 或更高版本
- Xcode Command Line Tools

#### 通用工具
- Rust 1.82+（[安装](https://rustup.rs/)）
- Node.js 18+（[安装](https://nodejs.org/)）
- Git 2.0+

### 快速检查

```bash
# 检查 Rust
rustc --version
cargo --version

# 检查 Node.js
node --version
npm --version

# 检查 Git
git --version
```

如果任何工具缺失或版本过低，按上面链接安装/升级。

## 本地构建流程

### 方法 1: 使用自动化脚本（推荐）

最简单的方式，脚本会自动完成所有步骤：

```bash
cd app
npm run build:local
```

**脚本会:**
1. ✅ 检查环境（Rust、Node.js 等）
2. ✅ 安装/验证依赖
3. ✅ 编译前端资源
4. ✅ 编译 Tauri 应用
5. ✅ 验证生成的安装包
6. ✅ 生成 SHA256 校验和

**耗时:** 15-30 分钟（首次更长，因为需要编译 Rust）

### 方法 2: 手动构建（细节控制）

如果需要对流程进行细粒度控制：

```bash
cd app

# 1. 安装依赖
npm ci

# 2. 构建前端资源
npm run build

# 3. 构建 Tauri 应用（完整构建）
npm run tauri:build

# 仅 Windows: 指定打包格式
npm run tauri:build -- --bundle msi

# 仅 macOS: 构建通用二进制
npm run tauri:build -- --target universal
```

### 方法 3: 快速验证编译（不生成安装包）

用于快速验证代码是否编译通过，不生成完整的安装包：

```bash
cd app/src-tauri

# 快速语法检查（10 秒）
cargo check

# 编译调试版本（不打包，3-5 分钟）
cargo build

# 完整编译（生成可运行的应用）
cargo build --release
```

## 生成的文件位置

### Windows

```
app/src-tauri/target/release/bundle/

├── msi/
│   └── FocusTodo_x64_en-US.msi        ← MSI 安装程序
│
└── nsis/
    └── FocusTodo_x64-setup.exe        ← EXE 安装程序
```

### macOS

```
app/src-tauri/target/

├── release/bundle/dmg/
│   └── FocusTodo_x64.dmg              ← Intel 版本
│
└── universal/release/bundle/dmg/
    └── FocusTodo_universal.dmg        ← Universal（推荐）
```

## 安装包测试

### Windows 测试流程

```bash
# 1. 进入文件夹
cd app/src-tauri/target/release/bundle/msi

# 2. 双击安装
# 或使用命令行
msiexec /i FocusTodo_x64_en-US.msi

# 3. 跟随安装向导
# 4. 安装完成后，从开始菜单或桌面快捷方式启动应用
```

**检查清单:**
- [ ] 安装程序能正常启动
- [ ] 安装目录正确（默认 `C:\Program Files\FocusTodo`）
- [ ] 开始菜单或桌面有快捷方式
- [ ] 应用能正常启动
- [ ] 所有功能正常（任务管理、番茄钟等）
- [ ] 卸载程序工作正常

### macOS 测试流程

```bash
# 1. 进入文件夹
cd app/src-tauri/target/release/bundle/dmg

# 2. 挂载 DMG 文件
open FocusTodo_universal.dmg

# 3. 在打开的 Finder 窗口中
# 拖拽 FocusTodo 应用到 Applications 文件夹

# 4. 启动应用
open /Applications/FocusTodo.app

# 或从 Launchpad/Spotlight 搜索启动
```

**检查清单:**
- [ ] DMG 文件能正常挂载
- [ ] 应用能拖拽到 Applications
- [ ] 应用能从 Spotlight 或 Launchpad 搜索到
- [ ] 双击应用能启动
- [ ] 首次启动无崩溃或权限错误
- [ ] 所有功能正常

### 功能测试（通用）

应用启动后，验证核心功能：

#### 任务管理
- [ ] 能创建新任务
- [ ] 能编辑任务内容
- [ ] 能标记任务完成
- [ ] 能删除任务
- [ ] 能设置任务优先级
- [ ] 任务列表能保存（重启应用后数据仍在）

#### 番茄钟
- [ ] 能进行 25 分钟专注
- [ ] 能进行短休息（5 分钟）
- [ ] 能进行长休息（15 分钟）
- [ ] 倒计时显示正确
- [ ] 可配置专注/休息时长
- [ ] Session 记录正确

#### 主窗口
- [ ] 能调整窗口大小
- [ ] 能移动窗口位置
- [ ] 窗口关闭后重启应用能恢复位置

#### 悬浮小窗（可选）
- [ ] 能显示/隐藏悬浮小窗
- [ ] 能拖拽悬浮小窗
- [ ] 能置顶悬浮小窗
- [ ] 悬浮小窗在系统任务栏中隐藏

## 校验和验证

### 生成校验和

使用本地构建脚本时会自动生成：

```
app/src-tauri/target/release/bundle/SHA256SUMS
```

手动生成校验和：

#### Windows (PowerShell)
```powershell
# 进入文件夹
cd app/src-tauri/target/release/bundle/msi

# 生成所有文件的校验和
Get-FileHash * -Algorithm SHA256 | Format-Table -AutoSize
```

#### macOS/Linux
```bash
# 进入文件夹
cd app/src-tauri/target/release/bundle/dmg

# 生成校验和
shasum -a 256 * > SHA256SUMS

# 查看结果
cat SHA256SUMS
```

### 校验文件完整性

```bash
# Windows PowerShell
Get-FileHash "FocusTodo_x64_en-US.msi" -Algorithm SHA256

# macOS/Linux
shasum -a 256 -c SHA256SUMS
```

对比输出的哈希值，确保与 `SHA256SUMS` 文件中的值完全相同。

## 故障排查

### 编译错误：Rust 版本不兼容

```
error: package requires rustc 1.82 or newer
```

**解决方案:**
```bash
# 更新 Rust
rustup update

# 验证版本
rustc --version
```

### 编译错误：依赖缺失

```
error: failed to resolve: use of undeclared crate
```

**解决方案:**
```bash
# 清理缓存
cd app/src-tauri
cargo clean

# 重新下载依赖
cargo build
```

### 构建超时（macOS）

某些 M1 Mac 上构建可能较慢，如果超时：

```bash
# 使用较少的并行任务
cd app
npm run tauri:build -- --args '--jobs=2'

# 或增加超时时间（在 tauri.conf.json）
```

### Windows 缺少 MSVC 工具链

```
error: linker `link.exe` not found
```

**解决方案:**

1. 从 [Visual Studio 官网](https://visualstudio.microsoft.com/downloads/) 下载"构建工具"
2. 运行安装程序，选择"C++ 生成工具"
3. 完成安装后重试

### macOS "app is damaged" 错误

```
"FocusTodo.app" is damaged and can't be opened
```

**解决方案:**

```bash
# 允许来自任何来源的应用
sudo spctl --master-disable

# 或针对本应用
xattr -rd com.apple.quarantine /Applications/FocusTodo.app
```

## 打包优化建议

### 减小文件大小

#### 前端优化
```bash
cd app
npm run build -- --mode production

# 检查输出大小
ls -lah dist/
```

#### Rust 优化
```toml
# app/src-tauri/Cargo.toml

[profile.release]
opt-level = 3          # 优化级别（0-3）
lto = true             # 启用链接时间优化
codegen-units = 1      # 单线程编译（更优化但更慢）
```

### 加速编译

```bash
# 使用 mold 链接器（Linux）
RUSTFLAGS="-C link-arg=-fuse-ld=mold" cargo build --release

# 使用增量编译
cd app/src-tauri
touch build.rs  # 触发重编译但保留缓存
```

## 自动化测试

### 添加单元测试（可选）

```rust
// app/src-tauri/src/storage/file_store.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_read() {
        // 测试代码
    }
}
```

运行测试：
```bash
cd app/src-tauri
cargo test
```

## 发布前检查清单

在运行 `npm run release` 之前：

### 代码检查
- [ ] 所有功能已测试
- [ ] 没有 TypeScript 编译错误
- [ ] 没有 Rust 编译警告（或已评估）
- [ ] 代码已 commit，工作目录干净

### 文档检查
- [ ] CHANGELOG 或发布说明已更新
- [ ] 版本号已同步到 `tauri.conf.json` 和 `Cargo.toml`
- [ ] README 中如有版本信息已更新

### 构建检查
- [ ] 本地 `npm run build:local` 成功
- [ ] 所有安装包文件生成正确
- [ ] Windows MSI 和 macOS DMG 都能正常安装

### 功能检查
- [ ] 新增功能已完整测试
- [ ] 修复的 bug 已验证
- [ ] 已测试从旧版本升级场景（如适用）

### 完成！

```bash
cd app
npm run release patch  # 或 minor/major
```

---

**提示:** 如构建失败，详见 [RELEASE.md](./RELEASE.md) 的故障排查部分。
