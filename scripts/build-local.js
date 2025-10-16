#!/usr/bin/env node

/**
 * 本地打包验证脚本
 *
 * 功能:
 * 1. 验证本地构建环境
 * 2. 执行完整的构建流程（不发布）
 * 3. 验证生成的安装包
 * 4. 生成校验和
 *
 * 使用方式:
 *   npm run build:local
 *   或
 *   node scripts/build-local.js [--skip-deps] [--skip-clean]
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

const COLOR = {
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  GRAY: '\x1b[90m',
  RESET: '\x1b[0m',
};

const PLATFORM = os.platform();
const APP_DIR = path.join(__dirname, '../app');
const BUILD_DIR = path.join(APP_DIR, 'src-tauri/target');

function log(color, message) {
  console.log(`${color}${message}${COLOR.RESET}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(COLOR.BLUE, `📌 ${title}`);
  console.log('='.repeat(60));
}

/**
 * 安全执行命令
 * @param {string} cmd 命令
 * @param {Object} options 选项
 * @returns {string} 输出
 */
function exec(cmd, options = {}) {
  const { silent = false, cwd = process.cwd(), ignoreErrors = false } = options;

  if (!silent) {
    log(COLOR.GRAY, `$ ${cmd}`);
  }

  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      cwd,
      windowsHide: true,
    });
    return (output || '').trim();
  } catch (error) {
    if (ignoreErrors) {
      return '';
    }
    log(COLOR.RED, `❌ 命令失败: ${cmd}`);
    if (error.stderr) {
      log(COLOR.RED, error.stderr.toString());
    }
    throw error;
  }
}

/**
 * 递归删除目录
 */
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  try {
    // 使用 Node.js 原生 API（跨平台）
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (error) {
    log(COLOR.YELLOW, `⚠️  无法删除目录 ${dirPath}: ${error.message}`);
  }
}

function checkEnvironment() {
  logSection('环境检查');

  const checks = [
    {
      name: 'Node.js',
      cmd: 'node --version',
      required: true,
    },
    {
      name: 'npm',
      cmd: 'npm --version',
      required: true,
    },
    {
      name: 'Rust',
      cmd: 'rustc --version',
      required: true,
    },
    {
      name: 'Cargo',
      cmd: 'cargo --version',
      required: true,
    },
  ];

  for (const check of checks) {
    try {
      const version = exec(check.cmd, { silent: true });
      log(COLOR.GREEN, `✓ ${check.name}: ${version}`);
    } catch {
      if (check.required) {
        log(COLOR.RED, `✗ ${check.name}: 未安装`);
        throw new Error(`缺少必要工具: ${check.name}`);
      }
      log(COLOR.YELLOW, `⚠ ${check.name}: 未安装（可选）`);
    }
  }
}

function installDependencies() {
  logSection('安装依赖');

  log(COLOR.BLUE, '📦 安装 npm 依赖...');
  try {
    exec(`npm ci`, { cwd: APP_DIR, ignoreErrors: false });
  } catch {
    log(COLOR.YELLOW, '   npm ci 失败，尝试 npm install...');
    exec(`npm install`, { cwd: APP_DIR });
  }
  log(COLOR.GREEN, '✓ npm 依赖安装完成');

  log(COLOR.BLUE, '📦 检查 Cargo 依赖...');
  exec(`cargo check`, { cwd: path.join(APP_DIR, 'src-tauri'), silent: true });
  log(COLOR.GREEN, '✓ Cargo 依赖检查完成');
}

function buildApp() {
  logSection('构建应用');

  log(COLOR.BLUE, '🔨 构建前端资源...');
  exec(`npm run build`, { cwd: APP_DIR });
  log(COLOR.GREEN, '✓ 前端构建完成');

  log(COLOR.BLUE, '🔨 构建 Tauri 应用...');
  let buildCmd = `npm run tauri:build`;

  // macOS 特殊处理
  if (PLATFORM === 'darwin') {
    buildCmd += ' -- --target universal';
    log(COLOR.YELLOW, 'ℹ macOS 构建通用二进制 (Universal)...');
  }

  exec(buildCmd, { cwd: APP_DIR });
  log(COLOR.GREEN, '✓ 应用构建完成');
}

function findBundles() {
  logSection('查找生成文件');

  const bundlePaths = {
    win32_exe: path.join(BUILD_DIR, 'release/bundle/nsis'),
    win32_msi: path.join(BUILD_DIR, 'release/bundle/msi'),
    darwin: path.join(BUILD_DIR, 'release/bundle/dmg'),
    darwin_universal: path.join(BUILD_DIR, 'universal/release/bundle/dmg'),
  };

  const bundles = [];

  // Windows
  if (PLATFORM === 'win32') {
    if (fs.existsSync(bundlePaths.win32_exe)) {
      const files = fs.readdirSync(bundlePaths.win32_exe).filter(f => f.endsWith('.exe'));
      bundles.push(...files.map(f => path.join(bundlePaths.win32_exe, f)));
    }
    if (fs.existsSync(bundlePaths.win32_msi)) {
      const files = fs.readdirSync(bundlePaths.win32_msi).filter(f => f.endsWith('.msi'));
      bundles.push(...files.map(f => path.join(bundlePaths.win32_msi, f)));
    }
  }

  // macOS
  if (PLATFORM === 'darwin') {
    const checkDirs = [bundlePaths.darwin_universal, bundlePaths.darwin];
    for (const dir of checkDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.dmg'));
        bundles.push(...files.map(f => path.join(dir, f)));
      }
    }
  }

  if (bundles.length === 0) {
    log(COLOR.RED, '❌ 未找到生成的安装包');
    log(COLOR.YELLOW, `   检查路径: ${BUILD_DIR}`);
    return [];
  }

  log(COLOR.GREEN, `✓ 找到 ${bundles.length} 个安装包:`);
  bundles.forEach(bundle => {
    const size = (fs.statSync(bundle).size / (1024 * 1024)).toFixed(2);
    log(COLOR.YELLOW, `   • ${path.basename(bundle)} (${size} MB)`);
  });

  return bundles;
}

function validateBundles(bundles) {
  logSection('验证安装包');

  for (const bundle of bundles) {
    const stats = fs.statSync(bundle);
    const size = stats.size / (1024 * 1024);
    const basename = path.basename(bundle);

    // 基本大小检查
    if (size < 1) {
      log(COLOR.RED, `✗ ${basename} 文件过小 (${size.toFixed(2)} MB)`);
      continue;
    }

    // Windows EXE/MSI
    if (basename.endsWith('.exe') || basename.endsWith('.msi')) {
      if (size < 10) {
        log(COLOR.RED, `✗ ${basename} 文件太小 (${size.toFixed(2)} MB)`);
      } else {
        log(COLOR.GREEN, `✓ ${basename} 有效 (${size.toFixed(2)} MB)`);
      }
    }

    // macOS DMG
    if (basename.endsWith('.dmg')) {
      if (size < 50) {
        log(COLOR.RED, `✗ ${basename} 文件太小 (${size.toFixed(2)} MB)`);
      } else {
        log(COLOR.GREEN, `✓ ${basename} 有效 (${size.toFixed(2)} MB)`);
      }
    }
  }
}

function generateChecksums(bundles) {
  logSection('生成校验和');

  if (bundles.length === 0) {
    log(COLOR.YELLOW, '⚠️  没有安装包，跳过校验和生成');
    return null;
  }

  const outputDir = path.dirname(bundles[0]);
  const outputFile = path.join(outputDir, 'SHA256SUMS');
  const hashes = [];
  const crypto = require('crypto');

  for (const bundle of bundles) {
    const content = fs.readFileSync(bundle);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const filename = path.basename(bundle);

    hashes.push(`${hash}  ${filename}`);
    log(COLOR.YELLOW, `${filename}`);
    log(COLOR.GRAY, `  ${hash}\n`);
  }

  fs.writeFileSync(outputFile, hashes.join('\n') + '\n');
  log(COLOR.GREEN, `✓ 校验和已保存: ${outputFile}`);

  return outputFile;
}

async function main() {
  try {
    log(COLOR.BLUE, '\n🚀 FocusTodo 本地构建验证工具\n');

    const args = process.argv.slice(2);
    const skipDeps = args.includes('--skip-deps');
    const skipClean = args.includes('--skip-clean');

    // 1. 环境检查
    checkEnvironment();

    // 2. 清理旧文件
    if (!skipClean && fs.existsSync(BUILD_DIR)) {
      logSection('清理旧文件');
      log(COLOR.BLUE, '清理构建目录...');
      removeDir(BUILD_DIR);
      log(COLOR.GREEN, '✓ 清理完成');
    }

    // 3. 安装依赖
    if (!skipDeps) {
      installDependencies();
    }

    // 4. 构建应用
    buildApp();

    // 5. 查找和验证安装包
    const bundles = findBundles();

    if (bundles.length > 0) {
      validateBundles(bundles);
      const checksumFile = generateChecksums(bundles);

      logSection('构建完成 ✅');
      log(COLOR.GREEN, '\n📦 安装包已生成!\n');
      log(COLOR.YELLOW, '后续步骤:');
      log(COLOR.YELLOW, `  1. 手动测试安装包功能`);
      if (checksumFile) {
        log(COLOR.YELLOW, `  2. 验证校验和: ${checksumFile}`);
      }
      log(COLOR.YELLOW, `  3. 确认无误后推送版本标签`);
      log(COLOR.YELLOW, `     npm run release patch\n`);
    } else {
      log(COLOR.RED, '\n❌ 构建完成，但未生成安装包\n');
      log(COLOR.YELLOW, '可能的原因:');
      log(COLOR.YELLOW, '  1. 构建输出路径不同');
      log(COLOR.YELLOW, `  2. 检查 ${BUILD_DIR}`);
      log(COLOR.YELLOW, '  3. 查看上面的构建日志是否有错误\n');
      process.exit(1);
    }

  } catch (error) {
    log(COLOR.RED, `\n❌ 错误: ${error.message}\n`);
    process.exit(1);
  }
}

main();
