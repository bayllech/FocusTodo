# GitHub 自动打包与发布指南

## 概述

本项目使用 GitHub Actions 实现自动化构建和发布，支持 **Windows** 和 **macOS** 平台的安装程序生成和分发。

## 打包流程

```
推送标签 (v1.0.0)
    ↓
GitHub Actions 触发
    ↓
并行构建 (Windows + macOS)
    ↓
生成安装文件 (.msi/.exe/.dmg)
    ↓
上传到 Release 并生成校验和
    ↓
用户可下载安装
```

## 快速开始

### 1. 打包发布（基于标签）

#### 方式A: 通过Git标签发布（推荐）

```bash
# 1. 确保所有更改已提交
git status

# 2. 创建版本标签（遵循语义化版本 semver）
git tag -a v1.0.0 -m "Release version 1.0.0"

# 3. 推送标签到GitHub
git push origin v1.0.0

# 或一次性推送所有标签
git push origin --tags
```

#### 方式B: 手动触发工作流

在GitHub网页端：
1. 进入 **Actions** 标签页
2. 选择 **"Build and Release"** 工作流
3. 点击 **"Run workflow"**
4. 选择分支（通常是 `master`）并确认

### 2. 监听打包进度

打包完成通常需要 **30-60 分钟**（取决于网络和系统负荷）：

1. 进入项目 **Actions** 标签页
2. 查看最新的工作流运行记录
3. 展开各个步骤查看日志：
   - ✅ 绿色勾: 构建成功
   - ❌ 红色叉: 构建失败，检查日志

### 3. 下载安装包

打包完成后，在 **Releases** 页面可以看到：

#### Windows 用户
- `FocusTodo_x64_en-US.msi` - MSI 安装程序（推荐）
- `FocusTodo_x64-setup.exe` - NSIS 安装程序（可选）

**安装方式:**
```bash
# 直接运行 MSI
msiexec /i FocusTodo_x64_en-US.msi

# 或双击安装
# 或通过 PowerShell 脚本安装
```

#### macOS 用户
- `FocusTodo_aarch64.dmg` - Apple Silicon (M1/M2/M3)
- `FocusTodo_x64.dmg` - Intel Mac
- `FocusTodo_universal.dmg` - 通用二进制（推荐，支持 M1 和 Intel）

**安装方式:**
```bash
# 1. 双击 DMG 文件打开
open FocusTodo_universal.dmg

# 2. 拖拽 FocusTodo 应用到 Applications 文件夹
# 3. 完成安装
```

### 4. 验证安装包完整性

每个 Release 包含 `SHA256SUMS` 文件用于验证安装包：

#### Windows
```powershell
# 计算文件校验和
Get-FileHash "FocusTodo_x64_en-US.msi" -Algorithm SHA256

# 对比 SHA256SUMS 中的值
```

#### macOS
```bash
# 计算文件校验和
shasum -a 256 FocusTodo_universal.dmg

# 对比 SHA256SUMS 中的值
```

## 版本管理规范

遵循 **语义化版本** (Semantic Versioning)：

```
v主版本号.次版本号.修订号

v1.0.0   - 重大功能版本
v1.1.0   - 新增功能版本
v1.0.1   - Bug 修复版本
v1.0.0-beta.1 - 测试版本
```

### 版本更新步骤

1. **更新 `tauri.conf.json` 版本号**
   ```json
   {
     "version": "1.0.0"
   }
   ```

2. **更新 `Cargo.toml` 版本号**
   ```toml
   [package]
   version = "1.0.0"
   ```

3. **提交更改**
   ```bash
   git add app/src-tauri/tauri.conf.json app/src-tauri/Cargo.toml
   git commit -m "chore: bump version to 1.0.0"
   ```

4. **创建版本标签**
   ```bash
   git tag -a v1.0.0 -m "Release 1.0.0"
   git push origin v1.0.0
   ```

## 工作流文件说明

### 触发条件

| 触发条件 | 说明 |
|---------|------|
| `push tags (v*.*.*)` | 推送版本标签时自动触发 |
| `workflow_dispatch` | 在 Actions 页面手动触发 |

### 构建矩阵

| 平台 | 操作系统 | 输出文件 |
|------|--------|--------|
| Windows | `windows-latest` | `.msi` / `.exe` |
| macOS (Intel) | `macos-latest` | `.dmg` |
| macOS (Apple Silicon) | `macos-latest` | `.dmg` (universal) |

### 构建步骤

1. **Checkout** - 拉取代码
2. **Install Rust** - 安装 Rust 编译器
3. **Install Node.js** - 安装 Node.js 环境
4. **npm ci** - 安装依赖（更安全的方式）
5. **tauri build** - 编译 Tauri 应用
6. **Upload artifacts** - 上传编译产物到临时存储
7. **Create Release** - 创建 GitHub Release 并附加安装包

## 故障排查

### 问题1: 构建失败 - Rust 编译错误

**症状:** GitHub Actions 日志显示 `error: failed to compile`

**解决方案:**
```bash
# 1. 本地验证是否能正确编译
cd app
npm run tauri:build

# 2. 检查 Rust 版本是否过老
rustc --version
cargo --version

# 3. 清理缓存后重试
cd app/src-tauri
cargo clean
cargo build
```

### 问题2: 打包输出文件不完整

**症状:** Release 中缺少某个平台的安装包

**解决方案:**
1. 检查 Actions 日志中该平台的构建步骤
2. 查看"Upload artifacts"步骤是否成功
3. 确认文件路径配置是否正确：
   - Windows: `target/release/bundle/msi/*.msi`
   - macOS: `target/release/bundle/dmg/*.dmg`

### 问题3: macOS 签名问题（可选）

若要实现自动代码签名，需在项目 Secrets 中配置：
- `MACOS_CERTIFICATE` - Base64 编码的证书文件
- `MACOS_CERTIFICATE_PWD` - 证书密码

配置方法详见 [Tauri 官方签名指南](https://tauri.app/v1/guides/distribution/sign-macos/)

## 高级配置

### 自定义构建参数

编辑 `.github/workflows/build.yml` 的 `Build Tauri app` 步骤：

```yaml
- name: Build Tauri app
  run: |
    cd app
    npm run tauri:build -- --debug  # 调试模式
```

### 自动增版本号

在 `Create Release` 前添加步骤：

```yaml
- name: Auto-update version
  run: |
    # 从标签提取版本号
    VERSION=${GITHUB_REF#refs/tags/v}
    # 更新 tauri.conf.json
    sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" app/src-tauri/tauri.conf.json
```

### 发送构建通知

将以下步骤添加到 Release 成功后：

```yaml
- name: Send Slack notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'FocusTodo ${{ github.ref_name }} 发布成功！'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## 常用命令参考

```bash
# 查看本地标签
git tag

# 查看某标签详情
git show v1.0.0

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin --delete v1.0.0

# 重新推送标签（覆盖）
git push origin v1.0.0 --force

# 查看工作流运行历史
gh run list

# 查看具体工作流运行日志
gh run view <run-id> --log
```

## 最佳实践

1. ✅ **版本号同步** - 在创建标签前，确保 `tauri.conf.json` 和 `Cargo.toml` 版本号一致
2. ✅ **功能完成** - 仅在功能测试完全通过后才发布版本
3. ✅ **校验和验证** - 用户下载安装包后应验证 SHA256 校验和
4. ✅ **变更日志** - 为每个版本编写详细的变更说明
5. ✅ **测试构建** - 在 Actions 中可先用 `workflow_dispatch` 手动测试

## 参考链接

- [Tauri 官方构建指南](https://tauri.app/v1/guides/building/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/lang/zh-CN/)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
