# 自动化打包发布 - 快速指南

> **中文 | [English](./QUICKSTART.en.md)**

## 📋 概览

这是一个完整的自动化打包解决方案，包含：

- ✅ GitHub Actions 自动构建（Windows + macOS）
- ✅ 自动版本管理和发布
- ✅ 本地测试验证工具
- ✅ 安装包校验和生成

## 🚀 快速发布（3步）

### 方案 A: 使用自动化脚本（推荐）

```bash
cd app

# 1. 验证本地能正常打包（可选但推荐）
npm run build:local

# 2. 自动更新版本、创建标签并推送
npm run release patch    # 修复版本
npm run release minor    # 新增功能
npm run release major    # 大版本更新
npm run release 1.2.3    # 指定具体版本
```

**发生了什么?**
- 自动更新 `tauri.conf.json` 和 `Cargo.toml`
- 创建 git 提交和标签
- 推送到 GitHub，触发 Actions 打包
- 生成的安装包会自动上传到 Releases 页面

### 方案 B: 手动标签发布

```bash
# 1. 手动更新版本
# 编辑 app/src-tauri/tauri.conf.json 和 app/src-tauri/Cargo.toml
# 修改 "version": "x.y.z"

# 2. 创建提交和标签
git add app/src-tauri/tauri.conf.json app/src-tauri/Cargo.toml
git commit -m "chore: release 1.0.0"
git tag -a v1.0.0 -m "Release 1.0.0"

# 3. 推送触发构建
git push origin master
git push origin v1.0.0
```

## 📦 监控打包进度

打开 GitHub Actions 页面查看实时进度：

```
https://github.com/<username>/FocusTodo/actions
```

- 通常需要 **30-60 分钟** 完成
- 点击工作流查看详细日志
- 构建完成后在 Releases 页面下载

## 💻 本地测试（可选）

在发布前验证打包是否正常：

```bash
cd app

# 完整的本地验证流程
npm run build:local

# 支持的选项
npm run build:local -- --skip-deps   # 跳过依赖安装（更快）
npm run build:local -- --skip-clean  # 跳过清理
```

**输出内容:**
- ✅ 环境检查（Node.js、Rust 等）
- ✅ 前端和后端编译
- ✅ 安装包生成验证
- ✅ SHA256 校验和

## 📥 下载安装

### Windows 用户

**选项1: MSI 安装程序（推荐）**
```bash
# 直接运行
FocusTodo_x64_en-US.msi

# 或通过命令行
msiexec /i FocusTodo_x64_en-US.msi
```

**选项2: EXE 安装程序**
```bash
FocusTodo_x64-setup.exe
```

### macOS 用户

**选项1: 通用二进制（推荐，支持 M1/Intel）**
```bash
open FocusTodo_universal.dmg
# 拖拽应用到 Applications 文件夹
```

**选项2: Intel Mac**
```bash
open FocusTodo_x64.dmg
```

**选项3: Apple Silicon (M1/M2)**
```bash
open FocusTodo_aarch64.dmg
```

## ✅ 验证安装包完整性

每个 Release 包含 `SHA256SUMS` 文件用于验证：

### Windows
```powershell
# PowerShell
Get-FileHash "FocusTodo_x64_en-US.msi" -Algorithm SHA256

# 对比 SHA256SUMS 中的值
```

### macOS / Linux
```bash
shasum -a 256 FocusTodo_universal.dmg

# 对比 SHA256SUMS 中的值
```

## 📊 工作流文件结构

```
.github/workflows/
└── build.yml              # 构建和发布工作流

scripts/
├── release.js             # 版本发布脚本
└── build-local.js         # 本地构建验证脚本

docs/
├── RELEASE.md             # 详细说明文档
└── QUICKSTART.md          # 本文件（快速指南）
```

## 🔧 常见问题

### Q: 如何跳过本地测试直接发布?

```bash
npm run release minor
```

脚本会提示确认，无需本地打包。

### Q: Actions 打包失败怎么办?

1. 进入 Actions 页面查看错误日志
2. 常见原因：
   - Rust 依赖问题 → 清理 `cargo clean` 后重试
   - Node.js 缓存 → 删除 `node_modules` 后重试
3. 查看 [RELEASE.md](./RELEASE.md) 的故障排查部分

### Q: 如何回滚错误的版本发布?

```bash
# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0

# 重新修正后再发布
npm run release patch
```

### Q: Windows 安装包给用户，但他们无法运行怎么办?

1. 要求用户验证 SHA256SUMS
2. 确认用户系统支持（Windows 7+）
3. 尝试以管理员身份运行安装程序
4. 检查是否被杀毒软件拦截

## 📚 更多信息

- [完整发布文档](./RELEASE.md) - 详细的配置和扩展说明
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Tauri 构建指南](https://tauri.app/v1/guides/building/)

## 💡 工作流总结

```
┌─────────────────────────────────────┐
│ 1. 本地开发和测试                    │
│    npm run build:local              │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│ 2. 发布新版本                        │
│    npm run release minor            │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│ 3. GitHub Actions 自动构建          │
│    - Windows: 生成 .msi / .exe      │
│    - macOS: 生成 .dmg               │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│ 4. 自动发布到 Releases              │
│    - 上传安装包                      │
│    - 生成校验和                      │
│    - 发布说明                        │
└─────────────────────────────────────┘
```

## 🎯 下一步

1. ✅ 将此文档提交到仓库
2. ✅ 创建第一个版本标签
3. ✅ 验证 Actions 工作流正常
4. ✅ 下载安装包测试
5. ✅ 分享给用户下载安装

---

**还有问题?** 查看 [RELEASE.md](./RELEASE.md) 或创建 Issue 讨论。
