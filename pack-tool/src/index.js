#!/usr/bin/env node
/**
 * pack-tool - Universal Expo project packaging tool
 *
 * Usage (standalone commands called by main.js):
 *   node src/index.js init [projectId]
 *   node src/index.js build <projectId>
 *   node src/index.js export <projectId>
 *   node src/index.js apk <projectId>
 *   node src/index.js status <projectId>
 *   node src/index.js history
 *   node src/index.js list
 *   node src/index.js add <projectId>
 *   node src/index.js apk-copy <projectId>
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

// ==========================================
// Main dispatcher
// ==========================================
async function main() {
  const showBanner = !['menu'].includes(cmd);
  if (showBanner) {
    console.log('');
    console.log('  ============================================');
    console.log('      Universal Expo Pack Tool v1.0');
    console.log('  ============================================');
    console.log('');
  }

  switch (cmd) {

    case 'init':
      config.init(projectId);
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
    console.log('    Root: ' + (p.root || '-'));
    console.log('    Output: ' + (p.outputDir || '-'));
    console.log('');
  });
}

async function doAdd() {
  const rl = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  const name = await ask('  App name [' + projectId + ']: ') || projectId;
  const root = await ask('  Project root [../client]: ') || '../client';
  const profile = await ask('  EAS profile [preview]: ') || 'preview';
  const output = await ask('  APK output dir [./output]: ') || './output';

  rl.close();
  config.addProject(projectId, {
    name, root, easProfile: profile, outputDir: output
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
// Utilities
// ==========================================

function showUsage(msg) {
  console.log('  [!] ' + msg);
  console.log('  Usage: node src/index.js <command> <projectId>');
  console.log('  Commands: init, build, export, apk, history, list, status, apk-copy');
}

function showHelp() {
  console.log('  Usage: node src/index.js <command> [projectId]');
  console.log('');
  console.log('  Commands:');
  console.log('    init           Initialize / reconfigure');
  console.log('    build <id>     Start EAS Build');
  console.log('    export <id>    Export source code');
  console.log('    apk <id>       View APK files');
  console.log('    status <id>    Check build status');
  console.log('    history <id>   View build history');
  console.log('    list           List all projects');
  console.log('    apk-copy <id>  Copy latest APK to output dir');
}

// Run
main().catch(err => {
  console.error('  [FATAL] ' + err.message);
  process.exit(1);
});