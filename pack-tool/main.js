/**
 * main.js - Universal Expo Pack Tool v1.0
 * 全中文交互式菜单，零 ANSI 编码，Windows CMD 完美兼容
 * 用法: node main.js  (或双击 pack.bat 启动)
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// ── 路径常量 ──
const TOOL_DIR = __dirname;
const CONFIG_PATH = path.join(TOOL_DIR, 'pack.config.json');
const INDEX_JS = path.join(TOOL_DIR, 'src', 'index.js');

// ── 辅助函数 ──
function println(txt) { console.log(txt || ''); }

function padCenter(text, width) {
  const len = text.length;
  if (len >= width) return text;
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

function pauseHint() {
  println();
  println('  按 Enter 键继续...');
}

async function waitEnter(msg) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question((msg || '  按 Enter 键继续...') + ' ', () => { rl.close(); resolve(); });
  });
}

async function askInput(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { projects: {} };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch { return { projects: {} }; }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

function hasValidProjects(config) {
  const projects = config.projects || {};
  return Object.keys(projects).length > 0;
}

// ── 子进程 ──
function runNodeScript(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [INDEX_JS].concat(args), {
      cwd: cwd || process.cwd(),
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('脚本退出码: ' + code));
    });
    child.on('error', reject);
  });
}

// ── 主界面 ──
function showBanner() {
  println('============================================');
  println(padCenter('Universal Expo Pack Tool v1.0', 44));
  println(padCenter('Multi-project, one-click build', 44));
  println('============================================');
}

function showMenu() {
  println();
  println('    [1]  Build APK (EAS Build)');
  println('    [2]  Export source code');
  println('    [3]  View / manage APK files');
  println('    [4]  View build history');
  println('    [5]  List configured projects');
  println('    [6]  Check EAS build status');
  println('    [7]  Init / reconfigure');
  println('    [0]  Exit');
  println();
}

async function doInit() {
  println();
  println('  === 项目配置 ===');
  println();

  const projectId = await askInput('  项目ID (英文, 如: suiyue): ');
  if (!projectId) { println('  已取消'); return; }

  const projectName = await askInput('  项目显示名称 (如: 岁月备忘录): ');
  const appName = projectName || projectId;

  const pathHint = process.platform === 'win32'
    ? '例如: D:\\projects\\myapp\\client'
    : '例如: /home/user/projects/myapp/client';
  const projectRoot = await askInput('  项目 client 目录完整路径\n  (' + pathHint + '): ');
  if (!projectRoot) { println('  已取消'); return; }

  const outHint = process.platform === 'win32'
    ? '例如: D:\\projects\\myapp\\output'
    : '例如: /home/user/projects/myapp/output';
  const outputDir = await askInput('  APK 输出目录完整路径\n  (' + outHint + '): ');
  if (!outputDir) { println('  已取消'); return; }

  const config = readConfig();
  config.projects = config.projects || {};
  config.projects[projectId] = {
    name: appName,
    root: projectRoot,
    outputDir: outputDir,
    platform: 'android',
    profile: 'preview',
  };
  saveConfig(config);

  println();
  println('  项目 "' + appName + '" 配置已保存!');
  println('  项目ID: ' + projectId);
  println('  项目路径: ' + projectRoot);
  println('  输出目录: ' + outputDir);
  println('  如需修改，请再次运行 [7] Init / reconfigure');
}

async function selectProject() {
  const config = readConfig();
  const projects = config.projects || {};
  const ids = Object.keys(projects);
  if (ids.length === 0) {
    println('  没有已配置的项目，请先选择 [7] 初始化配置');
    return null;
  }

  println();
  println('  选择项目:');
  ids.forEach((id, i) => {
    const p = projects[id];
    println('    [' + (i + 1) + '] ' + id + ' - ' + (p.name || id));
  });
  println('    [0] 取消');
  println();

  const choice = await askInput('  输入编号[1-' + ids.length + ']或项目ID: ');
  const num = parseInt(choice, 10);
  if (num === 0 || choice === '0') return null;

  let selectedId = null;
  if (num >= 1 && num <= ids.length) {
    selectedId = ids[num - 1];
  } else if (projects[choice]) {
    selectedId = choice;
  }

  if (!selectedId) {
    println('  无效选择');
    return null;
  }
  return selectedId;
}

async function doBuild() {
  const id = await selectProject();
  if (!id) return;
  const config = readConfig();
  const project = config.projects[id];
  try {
    println();
    println('  开始构建: ' + (project.name || id));
    println();
    await runNodeScript(['build', id], project.root);
    println();
    println('  构建完成!');
    println('  APK 下载后请放入: ' + project.outputDir);
  } catch (err) {
    println();
    println('  构建失败: ' + err.message);
    println('  请确保已安装 EAS CLI 并登录 (npx eas login)');
  }
}

async function doExport() {
  const id = await selectProject();
  if (!id) return;
  const config = readConfig();
  const project = config.projects[id];
  try {
    println();
    println('  开始导出源码包...');
    await runNodeScript(['export', id], project.root);
    println();
    println('  导出完成!');
  } catch (err) {
    println('  导出失败: ' + err.message);
  }
}

async function doAPK() {
  const id = await selectProject();
  if (!id) return;
  const config = readConfig();
  const project = config.projects[id];
  try {
    await runNodeScript(['apk', id], project.root);
  } catch (err) {
    println('  操作失败: ' + err.message);
  }
}

async function doHistory() {
  const id = await selectProject();
  if (!id) return;
  const config = readConfig();
  const project = config.projects[id];
  try {
    await runNodeScript(['history', id], project.root);
  } catch (err) {
    println('  操作失败: ' + err.message);
  }
}

async function doList() {
  const config = readConfig();
  const projects = config.projects || {};
  const ids = Object.keys(projects);
  println();
  if (ids.length === 0) {
    println('  尚未配置任何项目');
    println('  请选择 [7] Init / reconfigure 来添加项目');
    return;
  }
  println('  已配置的项目:');
  println();
  ids.forEach((id) => {
    const p = projects[id];
    println('    ID: ' + id);
    println('    名称: ' + (p.name || id));
    println('    路径: ' + (p.root || '(未设置)'));
    println('    输出: ' + (p.outputDir || '(未设置)'));
    println();
  });
}

async function doStatus() {
  const id = await selectProject();
  if (!id) return;
  const config = readConfig();
  const project = config.projects[id];
  try {
    await runNodeScript(['status', id], project.root);
  } catch (err) {
    println('  操作失败: ' + err.message);
  }
}

// ── 主循环 ──
async function main() {
  // 首次运行检测
  if (!fs.existsSync(CONFIG_PATH)) {
    println();
    println('  ============================================');
    println('    首次运行，请先配置你的项目');
    println('  ============================================');
    println();
    println('  准备好: 项目ID、名称、client目录路径、输出目录路径');
    println();
    println('  进入菜单后选择 [7] 来交互式配置');
    println();
    pauseHint();
    await waitEnter();
  }

  while (true) {
    console.clear();
    showBanner();

    const config = readConfig();
    if (!hasValidProjects(config)) {
      println('  *** 尚未配置任何项目 ***');
      println('  请选择 [7] 初始化配置');
    } else {
      const ids = Object.keys(config.projects);
      println('  已配置项目: ' + ids.map(id => config.projects[id].name || id).join(', '));
    }

    showMenu();

    const choice = await askInput('  请输入选项 [0-7]: ');
    const num = parseInt(choice, 10);

    let handled = true;
    switch (num) {
      case 1: await doBuild(); break;
      case 2: await doExport(); break;
      case 3: await doAPK(); break;
      case 4: await doHistory(); break;
      case 5: await doList(); break;
      case 6: await doStatus(); break;
      case 7: await doInit(); break;
      case 0:
        println('  再见!');
        return;
      default:
        println('  无效选项, 请输入 0-7');
        handled = false;
    }

    if (handled) {
      pauseHint();
      await waitEnter();
    }
  }
}

main().catch((err) => {
  console.error('  [错误] ' + err.message);
  console.error(err);
}).finally(() => {
  process.exit(0);
});