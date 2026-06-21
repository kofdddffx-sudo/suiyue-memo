#!/usr/bin/env node
/**
 *  pack-tool main.js
 *  
 *  Node.js 全权接管的主循环入口。
 *  pack.bat 只负责: 定位目录 → npm install → 启动这个文件
 *  之后所有交互全部由 Node.js 处理，不再依赖 bat 的 goto/errorlevel
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// ── 配置 ──────────────────────────────────────────
const TOOL_ROOT = __dirname;
const CONFIG_PATH = path.join(TOOL_ROOT, 'pack.config.json');
// 模板不再单独存放，firstRunCheck 直接生成默认配置

// ── ANSI 颜色 ──────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  dim: '\x1b[2m',
};

// ── 工具函数 ──────────────────────────────────────
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

function println(text = '') {
  console.log(text);
}

function printBanner() {
  clearScreen();
  println(C.cyan + '='.repeat(44) + C.reset);
  println(C.white + C.bold + '     Universal Expo Pack Tool v1.0' + C.reset);
  println(C.dim + '     Multi-project, one-click build' + C.reset);
  println(C.cyan + '='.repeat(44) + C.reset);
  println();
}

function waitEnter(msg = '按 Enter 键返回菜单...') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(C.dim + '  ' + msg + C.reset, () => {
      rl.close();
      resolve();
    });
  });
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function getProjectList() {
  const cfg = loadConfig();
  if (!cfg || !cfg.projects) return [];
  return Object.entries(cfg.projects).map(([id, p]) => ({ id, ...p }));
}

// ── 子命令执行 ────────────────────────────────────
function runNodeScript(scriptName, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(TOOL_ROOT, 'src', 'index.js'), scriptName, ...args], {
      cwd: TOOL_ROOT,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => reject(err));
  });
}

// ── 功能函数 ──────────────────────────────────────

async function doInit(args) {
  // 如果传了项目名，用参数模式
  if (args.length > 0) {
    return runNodeScript('init', ...args);
  }
  await runNodeScript('init');
}

async function doBuild() {
  const list = getProjectList();
  if (list.length === 0) {
    println(C.yellow + '  [?] 暂无项目配置，请先选择 [7] 初始化配置' + C.reset);
    return;
  }
  const project = await chooseProject(list, '选择要打包的项目');
  if (!project) return;

  println(C.green + '  [+] 开始 EAS Build: ' + project.name + C.reset);
  println(C.dim + '  ' + '-'.repeat(40) + C.reset);
  
  // 先检查 eas 登录状态
  try {
    const loginCheck = execSync('npx eas whoami 2>&1', {
      cwd: project.root || path.join(TOOL_ROOT, '..', 'client'),
      timeout: 15000,
      encoding: 'utf-8',
    });
    println('  EAS 账号: ' + (loginCheck.trim() || '未登录'));
  } catch {
    println(C.yellow + '  [!] 未登录 EAS，请先执行: npx eas login' + C.reset);
    println(C.yellow + '  或访问 https://expo.dev 注册' + C.reset);
  }

  println();
  await runNodeScript('build', project.id);
}

async function doExport() {
  const list = getProjectList();
  if (list.length === 0) {
    println(C.yellow + '  [?] 暂无项目配置，请先选择 [7] 初始化配置' + C.reset);
    return;
  }
  const project = await chooseProject(list, '选择要导出源码的项目');
  if (!project) return;
  await runNodeScript('export', project.id);
}

async function doAPK() {
  const list = getProjectList();
  if (list.length === 0) {
    println(C.yellow + '  [?] 暂无项目配置' + C.reset);
    return;
  }
  const project = await chooseProject(list, '选择要查看 APK 的项目');
  if (!project) return;
  await runNodeScript('apk', project.id);
}

async function doHistory() {
  const list = getProjectList();
  if (list.length === 0) {
    println(C.yellow + '  [?] 暂无项目配置' + C.reset);
    return;
  }
  await runNodeScript('history');
}

async function doListProjects() {
  await runNodeScript('list');
}

async function doStatus() {
  const list = getProjectList();
  if (list.length === 0) {
    println(C.yellow + '  [?] 暂无项目配置' + C.reset);
    return;
  }
  const project = await chooseProject(list, '选择要查看构建状态的项目');
  if (!project) return;
  await runNodeScript('status', project.id);
}

// ── 项目选择器 ────────────────────────────────────
async function chooseProject(list, prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    println(C.cyan + '  ' + prompt + C.reset);
    println();
    list.forEach((p, i) => {
      println('    ' + C.white + C.bold + '[' + (i + 1) + ']' + C.reset + ' ' + p.name + (p.id ? C.dim + ' (' + p.id + ')' + C.reset : ''));
    });
    println('    ' + C.dim + '[0] 取消' + C.reset);
    println();
    rl.question(C.dim + '  请输入编号 [1-' + list.length + ']: ' + C.reset, (answer) => {
      rl.close();
      const num = parseInt(answer.trim(), 10);
      if (num > 0 && num <= list.length) {
        resolve(list[num - 1]);
      } else {
        resolve(null);
      }
    });
  });
}

// ── 菜单显示与选择 ─────────────────────────────────
function showMenu() {
  const config = loadConfig();
  println(C.cyan + '  ' + (config ? '已配置 ' + Object.keys(config.projects || {}).length + ' 个项目' : '尚未配置') + C.reset);
  println();
  println('    ' + C.white + C.bold + ' [1]' + C.reset + '  Build APK (EAS Build)');
  println('    ' + C.white + C.bold + ' [2]' + C.reset + '  Export source code');
  println('    ' + C.white + C.bold + ' [3]' + C.reset + '  View / manage APK files');
  println('    ' + C.white + C.bold + ' [4]' + C.reset + '  View build history');
  println('    ' + C.white + C.bold + ' [5]' + C.reset + '  List configured projects');
  println('    ' + C.white + C.bold + ' [6]' + C.reset + '  Check EAS build status');
  println('    ' + C.white + C.bold + ' [7]' + C.reset + '  Init / reconfigure');
  println('    ' + C.white + C.bold + ' [0]' + C.reset + '  Exit');
  println();
  print(C.dim + '  Enter option [0-7]: ' + C.reset);
}

function print(promptStr) {
  process.stdout.write(promptStr);
}

// ── 主循环 ─────────────────────────────────────────
async function main() {
  let running = true;
  firstRunCheck();

  while (running) {
    printBanner();
    showMenu();

    const choice = await readChoice();

    switch (choice) {
      case 1:
        await doBuild();
        await waitEnter();
        break;
      case 2:
        await doExport();
        await waitEnter();
        break;
      case 3:
        await doAPK();
        await waitEnter();
        break;
      case 4:
        await doHistory();
        await waitEnter();
        break;
      case 5:
        await doListProjects();
        await waitEnter();
        break;
      case 6:
        await doStatus();
        await waitEnter();
        break;
      case 7: {
        const args = await getInitArgs();
        await doInit(args);
        await waitEnter();
        break;
      }
      case 0:
        running = false;
        println();
        println(C.green + '  Goodbye!' + C.reset);
        println();
        break;
      default:
        println(C.red + '  [!] Invalid option, please try again' + C.reset);
        await waitEnter('按 Enter 键继续...');
    }
  }
}

function firstRunCheck() {
  if (!fs.existsSync(CONFIG_PATH)) {
    println(C.cyan + '  [*] 首次运行，正在生成默认配置...' + C.reset);
    const defaultConfig = {
      outputDir: './apk-output',
      projects: {
        suiyue: {
          name: "岁月备忘录",
          root: "../client",
          appName: "岁月备忘录",
          platform: "android",
          profile: "preview"
        }
      }
    };
    saveConfig(defaultConfig);
    println(C.green + '  [+] 配置已创建: pack.config.json' + C.reset);
    println(C.yellow + '  [!] 请编辑 pack.config.json，确认项目路径正确后重新运行' + C.reset);
    println();
  }
}

async function readChoice() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => {
      rl.close();
      resolve(parseInt(line.trim(), 10) || -1);
    });
  });
}

async function getInitArgs() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    println(C.dim + '  输入项目ID (留空则按模板生成, 多个用空格分隔): ' + C.reset);
    rl.on('line', (line) => {
      rl.close();
      const trimmed = line.trim();
      resolve(trimmed ? trimmed.split(/\s+/) : []);
    });
  });
}

// ── 启动 ───────────────────────────────────────────
main().catch((err) => {
  console.error(C.red + '  [FATAL] ' + err.message + C.reset);
  console.error(err);
}).finally(() => {
  process.exit(0);
});