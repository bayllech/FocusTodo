# 快速参考卡 - GitHub Actions 自动化打包

## 🎯 核心命令（记住这 3 个！）

```bash
# 1️⃣  验证本地构建（可选但推荐）
cd app
npm run build:local

# 2️⃣  自动发布版本
npm run release patch    # 修复 (v1.0.0 → v1.0.1)
npm run release minor    # 功能 (v1.0.0 → v1.1.0)
npm run release major    # 大版本 (v1.0.0 → v2.0.0)

# 3️⃣  等待 GitHub Actions 完成 (30-60 分钟)
# → 打开 https://github.com/YOUR_NAME/FocusTodo/actions
# → Releases 页面下载安装包
```

---

## 📋 文件位置速查

```
项目根目录/
├── .github/workflows/build.yml        # 自动构建配置
├── scripts/release.js                 # 发布脚本
├── scripts/build-local.js             # 本地验证脚本
└── docs/
    ├── QUICKSTART.md                  # ⭐ 新手入门
    ├── RELEASE.md                     # 详细说明
    ├── TEST.md                        # 测试指南
    ├── TROUBLESHOOTING.md             # 问题排查
    └── BUILD_FIX.md                   # 修复说明
```

---

## ⏱️ 耗时预期

| 操作 | 耗时 | 说明 |
|------|------|------|
| `npm run build:local` | 20-40 分钟首次 | 首次编译 Rust 依赖很慢 |
| `npm run build:local` | 5-10 分钟增量 | 之后只重编改动部分 |
| `npm run release *` | < 1 分钟 | 本地快速操作 |
| GitHub Actions | 30-60 分钟 | 并行构建 Windows + macOS |

---

## 🆘 快速故障排查

| 问题 | 解决方案 |
|------|--------|
| `npm run build:local` 报错 | 检查路径，确保在 `app` 目录 |
| 脚本一直没输出 | 耐心等待（构建需要时间），按 Ctrl+C 中止 |
| Rust 编译失败 | `cd app/src-tauri && cargo clean` 后重试 |
| 找不到安装包 | 查看日志，搜索 `❌` 错误提示 |
| Windows 缺 MSVC 工具 | 装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/) |

---

## ✅ 检查清单

发布前确认：

- [ ] 代码已 commit（`git status` 干净）
- [ ] `tauri.conf.json` 版本号正确（若有修改）
- [ ] 本地 `npm run build:local` 成功
- [ ] 安装包能正常运行
- [ ] 准备好发布（或只是测试）

---

## 📦 输出文件位置

### Windows
```
app/src-tauri/target/release/bundle/
├── msi/
│   └── FocusTodo_x64_en-US.msi
└── nsis/
    └── FocusTodo_x64-setup.exe
```

### macOS
```
app/src-tauri/target/release/bundle/dmg/
└── FocusTodo_x64.dmg

或通用二进制:
app/src-tauri/target/universal/release/bundle/dmg/
└── FocusTodo_universal.dmg
```

---

## 🔑 重要概念

### 语义化版本（Semantic Versioning）
```
v主.次.修  例如: v1.2.3

- v0.1.0 到 v1.0.0: 开发版本
- v1.0.0: 正式 v1 发布
- v1.1.0: 新增功能
- v1.0.1: Bug 修复
- v2.0.0: 大版本，可能有破坏性改动
```

### npm scripts
```bash
npm run build:local    # 本地验证构建
npm run release        # 自动版本发布

# 内部使用（不需要手动调用）
npm run build          # 构建前端
npm run tauri:build    # 构建 Tauri 应用
npm run dev            # 开发模式
```

---

## 🎯 常见工作流

### 流程 1: 第一次发布
```bash
cd app
npm run build:local         # 本地测试（25 min）
npm run release 1.0.0       # 发布 v1.0.0
# 等待 Actions（45 min）
# → 检查 Releases 页面
```

### 流程 2: 发布新功能
```bash
# 在 master 提交功能代码
npm run release minor       # 自动 v1.0.0 → v1.1.0
# 等待 Actions（45 min）
```

### 流程 3: 紧急修复
```bash
# 修复 Bug
npm run release patch       # 自动 v1.1.0 → v1.1.1
# 等待 Actions（45 min）
```

---

## 🌐 查看发布进度

打开这个 URL（替换用户名）：
```
https://github.com/YOUR_USERNAME/FocusTodo/actions
```

或在项目页面点击 **Actions** 标签页

---

## 📚 学习资源

- 快速开始: [QUICKSTART.md](./docs/QUICKSTART.md)
- 完整指南: [RELEASE.md](./docs/RELEASE.md)
- 本地测试: [TEST.md](./docs/TEST.md)
- 问题排查: [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

---

## 💡 Pro Tips

✨ **Tip 1**: 首次构建会很慢，之后会快很多（有缓存）

✨ **Tip 2**: `--skip-deps` 选项可以跳过依赖检查，更快：
```bash
npm run build:local -- --skip-deps --skip-clean
```

✨ **Tip 3**: 保存构建产物用于分发：
```bash
cp -r app/src-tauri/target/release/bundle/* ~/Downloads/
```

✨ **Tip 4**: 用户验证安装包完整性：
```bash
# Windows (PowerShell)
Get-FileHash FocusTodo_x64_en-US.msi

# macOS/Linux
shasum -a 256 FocusTodo_universal.dmg
```

✨ **Tip 5**: 如果卡住了，按 `Ctrl+C` 中止重试

---

**记住：只需 3 条命令，剩下的全自动！** 🚀

```bash
npm run build:local
npm run release patch
# 等待并下载
```
