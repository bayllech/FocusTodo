# build:local 脚本修复说明

## 问题分析

原始脚本在 Windows 上存在以下问题：

1. ❌ **Shell 命令不兼容** - 使用 `||` 运算符（仅支持 Unix shell）
2. ❌ **路径分隔符** - 在 Windows 上使用 `rm -rf` 命令（Windows 没有 `rm`）
3. ❌ **输出处理** - 当 `stdio: 'inherit'` 时，`execSync` 返回 `null`

## 解决方案

### 修复 1: 替换 Shell 条件运算符
```javascript
// ❌ 原始（不兼容 Windows）
exec(`cd "${APP_DIR}" && npm ci || npm install`);

// ✅ 修复后（跨平台）
try {
  exec(`npm ci`, { cwd: APP_DIR });
} catch {
  exec(`npm install`, { cwd: APP_DIR });
}
```

### 修复 2: 使用 Node.js API 而非 Shell 命令
```javascript
// ❌ 原始（Windows 没有 rm 命令）
exec(`rm -rf "${BUILD_DIR}"`, true);

// ✅ 修复后（跨平台）
fs.rmSync(dirPath, { recursive: true, force: true });
```

### 修复 3: 处理 null 输出
```javascript
// ❌ 原始
return execSync(cmd, { ... }).trim();  // 当输出为 null 时崩溃

// ✅ 修复后
return (output || '').trim();  // 安全处理
```

### 修复 4: 改进目录变更方式
```javascript
// ❌ 原始（Shell cd 命令不跨平台）
exec(`cd "${APP_DIR}" && npm run build`);

// ✅ 修复后（使用 Node.js 原生 API）
process.chdir(APP_DIR);
exec(`npm run build`);
process.chdir(originalDir);
```

## 关键改进

| 功能 | 原始方式 | 修复方式 |
|------|--------|--------|
| 条件执行 | Shell `\|\|` | JavaScript try-catch |
| 目录操作 | Shell `cd` + `rm` | Node.js `fs` API |
| 输出处理 | 直接 `.trim()` | 安全 `\|\| ''` 处理 |
| 错误处理 | 单一 exec() | 多重 try-catch |

## 使用方式

现在脚本已在 Windows 上正常工作。你可以：

### 完整构建（包含清理依赖）
```bash
cd app
npm run build:local
```

### 快速构建（跳过依赖安装和目录清理）
```bash
cd app
npm run build:local -- --skip-deps --skip-clean
```

### 仅检查 Rust 编译（不生成安装包）
```bash
cd app
cargo check
```

## 预期耗时

- **首次完整构建**: 20-40 分钟（需要编译 Rust 依赖）
- **增量构建**: 5-10 分钟（仅重新编译改动部分）
- **--skip-deps 模式**: 15-25 分钟（跳过 npm 安装）

## 如果构建卡住

如果看到长时间无输出，按 <kbd>Ctrl+C</kbd> 停止，然后：

```bash
# 清理 Rust 缓存
cd app/src-tauri
cargo clean

# 重试
cd ../
npm run build:local -- --skip-deps --skip-clean
```

## 构建成功标志

构建完成时，你会看到：

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

此时安装包位于：
- **Windows**: `app/src-tauri/target/release/bundle/` 下的 `.msi` 或 `.exe`
- **macOS**: `app/src-tauri/target/release/bundle/dmg/` 或 `app/src-tauri/target/universal/release/bundle/dmg/`

---

**下一步**: 查看 [QUICKSTART.md](./QUICKSTART.md) 了解如何发布版本！
