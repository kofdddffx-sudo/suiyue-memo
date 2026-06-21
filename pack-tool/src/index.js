#!/usr/bin/env node

/**
 * pack-tool - Universal Expo project packaging tool
 *
 * Usage: pack <command> [projectId]
 */

const path = require('path');
const ConfigManager = require('./config-manager');
const EASBuilder = require('./eas-builder');
const Packager = require('./packager');
const APKManager = require('./apk-manager');

const TOOL_DIR = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const cmd = args[0] || 'help';
const projectId = args[1];

const config = new ConfigManager(TOOL_DIR);
const builder = new EASBuilder(TOOL_DIR, config);
const packager = new Packager(TOOL_DIR);
const apkManager = new APKManager(TOOL_DIR, config);

async function main() {
  if (cmd !== 'menu' && cmd !== 'interactive-build' && cmd !== 'interactive-export' && cmd !== 'interactive-apk') {
    console.log('');
    console.log('  ============================================');
    console.log('      Universal Expo Pack Tool v1.0');
    console.log('  ============================================');
    console.log('');
  }

  switch (cmd) {

    case 'init':
      config.init();
      break;

    case 'build':
      if (!projectId) { showUsage('Specify project ID'); break; }
      await builder.build(projectId);
      break;

    case 'export':
      if (!projectId) { showUsage('Specify project ID'); break; }
      await doExport();
      break;

    case 'apk':
      if (!projectId) { showUsage('Specify project ID'); break; }
      await doAPK();
      break;

    case 'history':
      if (!projectId) { showUsage('Specify project ID'); break; }
      apkManager.showHistory(projectId);
      break;

    case 'list':
      doList();
      break;

    case 'add':
      if (!projectId) { showUsage('Specify new project ID'); break; }
      await doAdd();
      break;

    case 'status':
      if (!projectId) { showUsage('Specify project ID'); break; }
      await builder.status(projectId);
      break;

    case 'apk-copy':
      if (!projectId) { showUsage('Specify project ID'); break; }
      await doAPKCopy();
      break;

    // Interactive commands for pack.bat
    case 'menu':
      showInteractiveMenu();
      return; // don't exit

    case 'interactive-build':
      await doInteractiveBuild();
      break;

    case 'interactive-export':
      await doInteractiveExport();
      break;

    case 'interactive-apk':
      await doInteractiveAPK();
      break;

    case 'interactive-history':
      await doInteractiveHistory();
      break;

    case 'interactive-status':
      await doInteractiveStatus();
      break;

    default:
      showHelp();
  }
}

// ==========================================
// Command implementations
// ==========================================

async function doExport() {
  const project = config.getProject(projectId);
  const outputPath = await packager.exportSource(
    project.root, project.outputDir, project.name
  );
  console.log('  [+] Source exported: ' + outputPath);
}

async function doAPK() {
  const project = config.getProject(projectId);
  const apks = apkManager.scanAPKs(project.outputDir);

  if (apks.length === 0) {
    console.log('  [!] No APK found in: ' + project.outputDir);
    return;
  }

  console.log('  APK directory: ' + project.outputDir);
  console.log('');
  apks.forEach((apk, i) => {
    console.log('  ' + (i === 0 ? '>>' : '  ') + ' ' + apk.name);
    console.log('      Size: ' + apk.size + ' MB | Modified: ' + apk.modified);
  });
  console.log('');

  const latest = apks[0];
  const validation = apkManager.validateAPK(latest.path);
  if (validation.valid) {
    console.log('  [+] APK validation passed!');
  } else {
    console.log('  [-] APK checks:');
    Object.entries(validation.checks).forEach(([key, pass]) => {
      console.log('     ' + (pass ? '+' : '-') + ' ' + key);
    });
  }
}

function doList() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  No projects configured');
    console.log('  Run: pack init');
    return;
  }

  console.log('  Configured projects (' + ids.length + '):');
  console.log('');
  ids.forEach(id => {
    const p = projects[id];
    console.log('  ' + id);
    console.log('    Name: ' + p.name);
    console.log('    Desc: ' + (p.description || '-'));
    console.log('    Root: ' + p.root);
    console.log('    Package: ' + p.packageName);
    console.log('    Output: ' + p.outputDir);
    console.log('');
  });
}

async function doAdd() {
  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  const name = await ask('  App name [' + projectId + ']: ') || projectId;
  const desc = await ask('  Description: ');
  const root = await ask('  Project root [../client]: ') || '../client';
  const pkg = await ask('  Android package [com.example.app]: ') || 'com.example.app';
  const profile = await ask('  EAS profile [preview]: ') || 'preview';
  const output = await ask('  APK output dir [./output]: ') || './output';

  rl.close();
  config.addProject(projectId, {
    name, description: desc, root, packageName: pkg,
    easProfile: profile, outputDir: output
  });
}

async function doAPKCopy() {
  const project = config.getProject(projectId);
  const apks = apkManager.scanAPKs(project.outputDir);

  if (apks.length === 0) {
    console.log('  [!] No APK found in: ' + project.outputDir);
    return;
  }

  const latest = apks[0];
  const result = apkManager.copyAPK(latest.path, project.outputDir, project.name);
  if (result.success) {
    console.log('  [+] APK copied to: ' + result.destPath);
  } else {
    console.log('  [-] Copy failed: ' + result.error);
  }
}

// ==========================================
// Interactive functions (called from pack.bat)
// ==========================================

function showInteractiveMenu() {
  console.log('');
  console.log('========================================');
  console.log('    Universal Expo Pack Tool v1.0');
  console.log('    Multi-project, one-click build');
  console.log('========================================');
  console.log('');
  console.log('    [1] Build APK (EAS Build)');
  console.log('    [2] Export source code');
  console.log('    [3] View / manage APK files');
  console.log('    [4] View build history');
  console.log('    [5] List configured projects');
  console.log('    [6] Check EAS build status');
  console.log('    [7] Init / reconfigure');
  console.log('    [0] Exit');
  console.log('');

  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });

  rl.question('  Enter option [0-7]: ', (answer) => {
    rl.close();
    const choice = answer.trim();
    switch (choice) {
      case '1': process.exit(100); break;
      case '2': process.exit(101); break;
      case '3': process.exit(102); break;
      case '4': process.exit(103); break;
      case '5': process.exit(104); break;
      case '6': process.exit(105); break;
      case '7': process.exit(106); break;
      case '0': process.exit(0); break;
      default:
        console.log('  Invalid option, try again');
        setTimeout(() => process.exit(99), 1000);
    }
  });
}

async function doInteractiveBuild() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  No projects configured. Run init first.');
    return;
  }

  console.log('');
  console.log('========================================');
  console.log('     Select project');
  console.log('========================================');
  console.log('');
  ids.forEach((id, i) => {
    console.log('    [' + (i + 1) + '] ' + id + ' - ' + projects[id].name);
  });
  console.log('');
  console.log('  Enter number[1-' + ids.length + '] or project ID:');

  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const selected = await new Promise(resolve => rl.question('  > ', resolve));
  rl.close();

  let pid = selected.trim();
  const idx = parseInt(pid);
  if (!isNaN(idx) && idx >= 1 && idx <= ids.length) {
    pid = ids[idx - 1];
  }

  if (!projects[pid]) {
    console.log('  Project not found: ' + pid);
    return;
  }

  console.log('');
  console.log('========================================');
  console.log('  Building: ' + projects[pid].name);
  console.log('========================================');
  console.log('');
  await builder.build(pid);
}

async function doInteractiveExport() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  No projects configured.');
    return;
  }

  console.log('');
  ids.forEach((id, i) => {
    console.log('  [' + (i + 1) + '] ' + id + ' - ' + projects[id].name);
  });
  console.log('');

  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const selected = await new Promise(resolve => rl.question('  Enter number or project ID: ', resolve));
  rl.close();

  let pid = selected.trim();
  const idx = parseInt(pid);
  if (!isNaN(idx) && idx >= 1 && idx <= ids.length) pid = ids[idx - 1];

  if (!projects[pid]) { console.log('  Project not found'); return; }

  const project = projects[pid];
  const outputPath = await packager.exportSource(project.root, project.outputDir, project.name);
  console.log('  [+] Source exported: ' + outputPath);
}

async function doInteractiveAPK() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  No projects configured.');
    return;
  }

  console.log('');
  ids.forEach((id, i) => {
    console.log('  [' + (i + 1) + '] ' + id + ' - ' + projects[id].name);
  });
  console.log('');

  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const selected = await new Promise(resolve => rl.question('  Enter number or project ID: ', resolve));
  rl.close();

  let pid = selected.trim();
  const idx = parseInt(pid);
  if (!isNaN(idx) && idx >= 1 && idx <= ids.length) pid = ids[idx - 1];

  if (!projects[pid]) { console.log('  Project not found'); return; }

  const project = projects[pid];
  const apks = apkManager.scanAPKs(project.outputDir);

  if (apks.length === 0) {
    console.log('  No APK found in: ' + project.outputDir);
    return;
  }

  console.log('  APK directory: ' + project.outputDir);
  console.log('');
  apks.forEach((apk, i) => {
    console.log('  ' + (i === 0 ? '>>' : '  ') + ' ' + apk.name);
    console.log('      Size: ' + apk.size + ' MB | Time: ' + apk.modified);
  });
  console.log('');

  const latest = apks[0];
  const validation = apkManager.validateAPK(latest.path);
  if (validation.valid) {
    console.log('  [+] APK validation passed!');
  } else {
    console.log('  [-] APK checks:');
    Object.entries(validation.checks).forEach(([key, pass]) => {
      console.log('     ' + (pass ? '+' : '-') + ' ' + key);
    });
  }

  console.log('');
  console.log('  Options:');
  console.log('    [C] Copy APK to output directory');
  console.log('    [0] Back');
  console.log('');

  const rl2 = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const op = await new Promise(resolve => rl2.question('  > ', resolve));
  rl2.close();

  if (op.trim().toLowerCase() === 'c') {
    const result = apkManager.copyAPK(latest.path, project.outputDir, project.name);
    if (result.success) {
      console.log('  [+] APK copied to: ' + result.destPath);
    } else {
      console.log('  [-] Copy failed: ' + result.error);
    }
  }
}

async function doInteractiveHistory() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  No projects configured.');
    return;
  }

  console.log('');
  ids.forEach((id, i) => {
    console.log('  [' + (i + 1) + '] ' + id + ' - ' + projects[id].name);
  });
  console.log('');

  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const selected = await new Promise(resolve => rl.question('  Enter number or project ID: ', resolve));
  rl.close();

  let pid = selected.trim();
  const idx = parseInt(pid);
  if (!isNaN(idx) && idx >= 1 && idx <= ids.length) pid = ids[idx - 1];

  if (!projects[pid]) { console.log('  Project not found'); return; }
  apkManager.showHistory(pid);
}

async function doInteractiveStatus() {
  const projects = config.getProjects();
  const ids = Object.keys(projects);

  if (ids.length === 0) {
    console.log('  No projects configured.');
    return;
  }

  console.log('');
  ids.forEach((id, i) => {
    console.log('  [' + (i + 1) + '] ' + id + ' - ' + projects[id].name);
  });
  console.log('');

  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const selected = await new Promise(resolve => rl.question('  Enter number or project ID: ', resolve));
  rl.close();

  let pid = selected.trim();
  const idx = parseInt(pid);
  if (!isNaN(idx) && idx >= 1 && idx <= ids.length) pid = ids[idx - 1];

  if (!projects[pid]) { console.log('  Project not found'); return; }
  await builder.status(pid);
}

// ==========================================
// Help
// ==========================================

function showUsage(msg) {
  if (msg) console.error('  [!] ' + msg);
  console.log('');
  console.log('  Usage: pack <command> [projectId]');
  console.log('');
  console.log('  Commands:');
  console.log('    init             Init packaging config');
  console.log('    build <id>       Run EAS Build');
  console.log('    export <id>      Export project source');
  console.log('    apk <id>         Manage APK files');
  console.log('    apk-copy <id>    Copy latest APK');
  console.log('    history <id>     View build history');
  console.log('    status <id>      Check EAS build status');
  console.log('    list             List all projects');
  console.log('    add <id>         Add new project');
  console.log('');
  console.log('  Examples:');
  console.log('    pack init');
  console.log('    pack build suiyue');
  console.log('    pack apk suiyue');
}

function showHelp() {
  showUsage();
}

main().catch(err => {
  console.error('  [!] Error:', err.message);
  process.exit(1);
});