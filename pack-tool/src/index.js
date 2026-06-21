#!/usr/bin/env node

/**
 * pack-tool - 通用 Expo 项目打包工具
 *
 * 使用: pack <命令> [项目ID]
 *
 * 命令:
 *   init         初始化打包配置
 *   build        执行 EAS Build 云端打包
 *   export       导出项目源码压缩包
 *   apk          管理 APK 文件
 *   history      查看构建历史
 *   list         列出已配置的项目
 *   add          添加新项目配置
 *
 * 示例:
 *   pack init
 *   pack build suiyue
 *   pack export suiyue
 *   pack apk suiyue
 *   pack history suiyue
 *   pack list
 *   pack add my-new-app
 */

const path = require('path');
const ConfigManager = require('./config-manager');
const EASBuilder = require('./eas-builder');
const Packager = require('./packager');
const APKManager = require('./apk-manager');

// 工具根目录
const TOOL_DIR = path.resolve(__dirname, '..');

// 解析命令
const args = process.argv.slice(2);
const cmd = args[0] || 'help';
const projectId = args[1];

// 初始化各模块
const config = new ConfigManager(TOOL_DIR);
const builder = new EASBuilder(TOOL_DIR, config);
const packager = new Packager(TOOL_DIR);
const apkManager = new APKManager(TOOL_DIR, config);

// ==========================================
// 命令执行器
// ==========================================
async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   通用 Expo 打包工具 v1.0        ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log('');

  switch (cmd) {

    // ===================== init =====================
    case 'init':
      config.init();
      break;

    // ===================== build =====================
    case 'build':
      if (!projectId) { showUsage('请指定项目ID'); break; }
      await builder.build(projectId);
      break;

    // ===================== export =====================
    case 'export':
      if (!projectId) { showUsage('请指定项目ID'); break; }
      await doExport();
      break;

    // ===================== apk =====================
    case 'apk':
      if (!projectId) { showUsage('请指定项目ID'); break; }
      await doAPK();
      break;

    // ===================== history =====================
    case 'history':
      if (!projectId) { showUsage('请指定项目ID'); break; }
      apkManager.showHistory(projectId);
      break;

    // ===================== list =====================
    case 'list':
      doList();
      break;

    // ===================== add =====================
    case 'add':
      if (!projectId) { showUsage('请指定新项目ID'); break; }
      await doAdd();
      break;

    // ===================== status =====================
    case 'status':
      if (!projectId) { showUsage('请指定项目ID'); break; }
      await builder.status(projectId);
      break;

    // ===================== apk-copy =====================
    case 'apk-copy':
      if (!projectId) { showUsage('请指定项目ID'); break; }
      await doAPKCopy();
      break;

    // ===================== help =====================
    default:
      showHelp();
  }
}

// ==========================================
// 命令实现
// ==========================================

async function doExport() {
  const project = config.getProject(projectId);
  const outputPath = await packager.exportSource(
    project.root,
    project.outputDir,
    project.name
  );
  console.log(`  [+] 源码已导出: ${outputPath}`);
}

async function doAPK() {
  const project = config.getProject(projectId);
  const apks = apkManager.scanAPKs(project.outputDir);

  if (apks.length === 0) {
    console.log(`  [!] ${project.outputDir} 中未找到 APK 文件`);
    console.log('');
    console.log('  [?] 请先打包: pack build ' + projectId);
    return;
  }

  console.log(`  APK 目录: ${project.outputDir}`);
  console.log('');
  apks.forEach((apk, i) => {
    const flag = i === 0 ? '>>' : '  ';
    console.log(`  ${flag} ${apk.name}`);
    console.log(`      大小: ${apk.size} MB | 时间: ${apk.modified}`);
  });
  console.log('');

  // 验证最新的 APK
  const latest = apks[0];
  const validation = apkManager.validateAPK(latest.path);
  if (validation.valid) {
    console.log('  [+] APK 验证通过!');
  } else {
    console.log('  [-] APK 验证:');
    Object.entries(validation.checks).forEach(([key, pass]) => {
      console.log(`     ${pass ? '+' : '-'} ${key}`);
    });
  }
}

function doList() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  暂无项目配置');
    console.log('  请执行: pack init');
    return;
  }

  console.log(`  已配置项目 (${ids.length}):`);
  console.log('');
  ids.forEach(id => {
    const p = projects[id];
    console.log(`  ${id}`);
    console.log(`    名称: ${p.name}`);
    console.log(`    描述: ${p.description || '-'}`);
    console.log(`    目录: ${p.root}`);
    console.log(`    包名: ${p.packageName}`);
    console.log(`    输出: ${p.outputDir}`);
    console.log('');
  });
}

async function doAdd() {
  // 交互式添加项目（简化版，使用默认值）
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  const name = await ask(`  应用名称 [${projectId}]: `) || projectId;
  const desc = await ask(`  应用描述: `);
  const root = await ask(`  项目目录 [../client]: `) || '../client';
  const pkg = await ask(`  Android 包名 [com.example.app]: `) || 'com.example.app';
  const profile = await ask(`  EAS 构建配置 [preview]: `) || 'preview';
  const output = await ask(`  APK 输出目录 [./output]: `) || './output';

  rl.close();

  config.addProject(projectId, { name, description: desc, root, packageName: pkg, easProfile: profile, outputDir: output });
}

async function doAPKCopy() {
  const project = config.getProject(projectId);
  const apks = apkManager.scanAPKs(project.outputDir);

  if (apks.length === 0) {
    console.log(`  [!] ${project.outputDir} 中未找到 APK 文件`);
    return;
  }

  const latest = apks[0];
  const result = apkManager.copyAPK(latest.path, project.outputDir, project.name);
  if (result.success) {
    console.log(`  [+] APK 已复制到: ${result.destPath}`);
  } else {
    console.log(`  [-] 复制失败: ${result.error}`);
  }
}

// ==========================================
// 辅助函数
// ==========================================

function showUsage(msg) {
  if (msg) console.error(`  [!] ${msg}`);
  console.log('');
  console.log('  用法: pack <命令> [项目ID]');
  console.log('');
  console.log('  命令:');
  console.log('    init             初始化打包配置');
  console.log('    build <id>       执行 EAS Build');
  console.log('    export <id>      导出项目源码');
  console.log('    apk <id>         管理 APK 文件');
  console.log('    apk-copy <id>    复制最新 APK 到输出目录');
  console.log('    history <id>     查看构建历史');
  console.log('    status <id>      查看 EAS 构建状态');
  console.log('    list             列出所有项目');
  console.log('    add <id>         添加新项目');
  console.log('');
  console.log('  示例:');
  console.log('    pack init');
  console.log('    pack build suiyue');
  console.log('    pack apk suiyue');
}

function showHelp() {
  showUsage();
}

main().catch(err => {
  console.error('  [!] 错误:', err.message);
  process.exit(1);
});