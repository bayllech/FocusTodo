#!/usr/bin/env node

/**
 * 自动化版本发布脚本
 *
 * 功能:
 * 1. 更新版本号（tauri.conf.json 和 Cargo.toml）
 * 2. 创建 git 提交和标签
 * 3. 推送到 GitHub 并触发 Actions
 *
 * 使用方式:
 *   node scripts/release.js <version>
 *   node scripts/release.js patch|minor|major
 *
 * 示例:
 *   node scripts/release.js 1.1.0
 *   node scripts/release.js minor
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLOR = {
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
};

function log(color, message) {
  console.log(`${color}${message}${COLOR.RESET}`);
}

function exec(cmd, silent = false) {
  if (!silent) log(COLOR.BLUE, `$ ${cmd}`);
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch (error) {
    log(COLOR.RED, `命令执行失败: ${error.message}`);
    process.exit(1);
  }
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data, pretty = true) {
  const content = pretty ? JSON.stringify(data, null, 2) + '\n' : JSON.stringify(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

function readTOML(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function writeTOML(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function updateTOMLVersion(filePath, newVersion) {
  let content = readTOML(filePath);
  content = content.replace(
    /version = "[\d.]+"/,
    `version = "${newVersion}"`
  );
  writeTOML(filePath, content);
}

function parseVersion(versionStr) {
  const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`无效的版本格式: ${versionStr}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || '',
  };
}

function versionToString(parsed) {
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.prerelease}`;
}

function bumpVersion(currentVersion, bumpType) {
  const parsed = parseVersion(currentVersion);

  switch (bumpType) {
    case 'major':
      parsed.major++;
      parsed.minor = 0;
      parsed.patch = 0;
      break;
    case 'minor':
      parsed.minor++;
      parsed.patch = 0;
      break;
    case 'patch':
      parsed.patch++;
      break;
    default:
      throw new Error(`未知的版本类型: ${bumpType}`);
  }

  parsed.prerelease = '';
  return versionToString(parsed);
}

function isValidVersion(version) {
  return /^(\d+)\.(\d+)\.(\d+)(.*)$/.test(version);
}

async function main() {
  try {
    // 1. 验证环境
    log(COLOR.BLUE, '📋 检查环境...');

    // 确定项目根目录
    // 脚本位于 scripts/release.js，所以往上两级
    let projectRoot = process.cwd();

    // 如果在 app 目录，往上走一级
    if (projectRoot.endsWith('app')) {
      projectRoot = path.dirname(projectRoot);
    }

    // 再检查一次，如果在 scripts 目录，往上走两级
    if (projectRoot.endsWith('scripts')) {
      projectRoot = path.dirname(path.dirname(projectRoot));
    }

    // 检查是否在项目根目录或其子目录
    const tauriConfPath = path.join(projectRoot, 'app/src-tauri/tauri.conf.json');
    const cargoTomlPath = path.join(projectRoot, 'app/src-tauri/Cargo.toml');

    if (!fs.existsSync(tauriConfPath) || !fs.existsSync(cargoTomlPath)) {
      throw new Error(`项目文件未找到。请在项目根目录或 app 目录运行此脚本\n  检查路径: ${tauriConfPath}`);
    }

    // 切换到项目根目录
    process.chdir(projectRoot);

    // 检查 git 状态
    const gitStatus = exec('git status --porcelain', true);
    if (gitStatus) {
      throw new Error('工作目录有未提交的更改，请先提交所有更改');
    }

    // 2. 解析版本参数
    let newVersion = process.argv[2];
    if (!newVersion) {
      throw new Error('请指定版本号或版本类型 (major|minor|patch|x.y.z)');
    }

    const tauriConf = readJSON(tauriConfPath);
    const currentVersion = tauriConf.version;

    // 如果是相对版本，计算新版本
    if (['major', 'minor', 'patch'].includes(newVersion)) {
      newVersion = bumpVersion(currentVersion, newVersion);
    } else if (!isValidVersion(newVersion)) {
      throw new Error(`无效的版本格式: ${newVersion}`);
    }

    log(COLOR.YELLOW, `\n版本更新: ${currentVersion} → ${newVersion}`);

    // 3. 询问确认
    log(COLOR.YELLOW, '\n⚠️  确认操作:');
    log(COLOR.YELLOW, `   - 更新版本号到 ${newVersion}`);
    log(COLOR.YELLOW, `   - 创建 git 提交: "chore: release ${newVersion}"`);
    log(COLOR.YELLOW, `   - 创建 git 标签: v${newVersion}`);
    log(COLOR.YELLOW, `   - 推送标签到 GitHub 并触发 Actions`);

    // 简化版本确认（自动继续）
    log(COLOR.GREEN, '\n✅ 开始发布流程...\n');

    // 4. 更新版本号
    log(COLOR.BLUE, '📝 更新版本号...');

    tauriConf.version = newVersion;
    writeJSON(tauriConfPath, tauriConf);
    log(COLOR.GREEN, `   ✓ tauri.conf.json: ${newVersion}`);

    updateTOMLVersion(cargoTomlPath, newVersion);
    log(COLOR.GREEN, `   ✓ Cargo.toml: ${newVersion}`);

    // 5. 创建提交
    log(COLOR.BLUE, '📦 创建 git 提交和标签...');

    exec('git add app/src-tauri/tauri.conf.json app/src-tauri/Cargo.toml');
    exec(`git commit -m "chore: release ${newVersion}"`);
    log(COLOR.GREEN, `   ✓ 提交创建: chore: release ${newVersion}`);

    exec(`git tag -a v${newVersion} -m "Release ${newVersion}"`);
    log(COLOR.GREEN, `   ✓ 标签创建: v${newVersion}`);

    // 6. 推送到远程
    log(COLOR.BLUE, '🚀 推送到 GitHub...');

    exec('git push origin master');
    log(COLOR.GREEN, `   ✓ 代码推送完成`);

    exec(`git push origin v${newVersion}`);
    log(COLOR.GREEN, `   ✓ 标签推送完成`);

    // 7. 打印后续步骤
    log(COLOR.GREEN, '\n✅ 发布流程已启动！\n');
    log(COLOR.YELLOW, '📊 后续步骤:');
    log(COLOR.YELLOW, '   1. 查看 GitHub Actions 进度: https://github.com/<owner>/<repo>/actions');
    log(COLOR.YELLOW, `   2. 打包通常需要 30-60 分钟`);
    log(COLOR.YELLOW, `   3. 完成后在 Releases 页面下载安装包`);
    log(COLOR.YELLOW, `   4. 验证文件校验和 (SHA256SUMS)\n`);

  } catch (error) {
    log(COLOR.RED, `\n❌ 错误: ${error.message}\n`);
    process.exit(1);
  }
}

main();
