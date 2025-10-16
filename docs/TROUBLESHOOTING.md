# 常见问题与快速解决方案

## 🔴 npm run build:local 直接报错

### 问题：找不到命令或权限错误

**症状：**
```
npm ERR! code ENOENT
npm ERR! 命令失败
```

**解决方案：**
```bash
# 1. 确保在 app 目录中
cd app

# 2. 重新安装依赖
npm install

# 3. 尝试运行
npm run build:local
```

---

## 🟡 构建过程中卡住

### 问题：很长时间没有输出

**症状：** 脚本运行后 10+ 分钟没有任何输出

**原因：**
- Rust 编译需要时间（这很正常！）
- 在 Windows 上首次编译可能需要 20-40 分钟

**解决方案：**
```bash
# 保持耐心等待（正在编译 Rust 依赖）
# 首次构建确实需要很长时间

# 如果真的卡住了，按 Ctrl+C 中止并重试
npm run build:local -- --skip-deps --skip-clean
```

---

## 🔴 Rust 编译错误

### 问题1：`error: failed to compile`

**解决方案：**
```bash
# 清理旧缓存
cd app/src-tauri
cargo clean

# 重新编译
cargo build
```

### 问题2：`error: linker 'link.exe' not found`

**原因：** Windows 缺少 C++ 构建工具

**解决方案：**
1. 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
2. 运行安装程序，选择 **"Desktop development with C++"**
3. 完成安装后重试

### 问题3：`error: couldn't compile the application`

**解决方案：**
```bash
# 检查 Rust 版本
rustc --version

# 如果版本过旧，更新
rustup update

# 再试一次
npm run build:local
```

---

## 🔴 前端编译错误

### 问题：TypeScript 类型错误

**症状：**
```
error TS2307: Cannot find module
```

**解决方案：**
```bash
cd app

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 检查类型
npx tsc --noEmit

# 重试构建
npm run build:local
```

---

## 🔴 找不到安装包

### 问题：构建完成但没生成 .msi/.dmg 文件

**可能原因：**
1. 构建实际上失败了（需要向上看日志）
2. 输出路径不同
3. Windows 防火墙或杀毒软件干扰

**调试步骤：**
```bash
# 检查输出目录
ls -la app/src-tauri/target/release/bundle/

# 如果目录为空，查看构建日志是否有错误
# 看 "🔨 构建 Tauri 应用" 部分的输出
```

---

## 🟡 构建速度很慢

### 优化建议

**方案 1: 跳过依赖检查（最快）**
```bash
npm run build:local -- --skip-deps --skip-clean
```

**方案 2: 只编译 Rust（不打包）**
```bash
cd app/src-tauri
cargo build --release
# 这样只编译，不生成 .msi/.dmg 安装包
```

**方案 3: 使用调试模式（更快但文件更大）**
```bash
cd app
npm run tauri:build -- --debug
```

---

## 🟡 Windows Defender 或杀毒软件干扰

### 问题：构建被中断或变得非常慢

**解决方案：**
1. 临时禁用实时扫描（如果安全）
2. 将 `app/src-tauri/target/` 目录加入排除列表
3. 在 PowerShell（管理员）中运行：
   ```powershell
   Add-MpPreference -ExclusionPath "C:\path\to\FocusTodo\app\src-tauri\target"
   ```

---

## ✅ 构建成功的标志

当看到这个输出时，说明一切正常：

```
============================================================
📌 构建完成 ✅
============================================================

📦 安装包已生成!

后续步骤:
  1. 手动测试安装包功能
  2. 验证校验和: ...
  3. 确认无误后推送版本标签
     npm run release patch
```

此时你的安装包位于：
```
# Windows
app/src-tauri/target/release/bundle/msi/*.msi
app/src-tauri/target/release/bundle/nsis/*.exe

# macOS
app/src-tauri/target/release/bundle/dmg/*.dmg
```

---

## 📋 完整排查清单

遇到问题时按顺序尝试：

- [ ] 确保在 `app` 目录中运行命令
- [ ] 检查 Node.js 版本 >= 18：`node --version`
- [ ] 检查 Rust 版本 >= 1.82：`rustc --version`
- [ ] 清理缓存：`cd app/src-tauri && cargo clean`
- [ ] 重装依赖：`npm install`
- [ ] 使用 --skip-deps 跳过检查：`npm run build:local -- --skip-deps`
- [ ] 查看详细构建日志
- [ ] 在 GitHub Issues 寻找类似问题
- [ ] 创建新 Issue 描述问题

---

## 🆘 还是无法解决？

1. **检查日志** - 向上滚动看完整的错误信息
2. **查看文档** - [TEST.md](./TEST.md) 有详细的本地测试指南
3. **搜索问题** - 在 GitHub Issues 或 Tauri 文档中搜索错误信息
4. **创建 Issue** - 提供完整的错误日志和系统信息

---

**提示：** 大多数构建问题与缺失工具或缓存有关。首先尝试清理缓存和重新安装依赖！
