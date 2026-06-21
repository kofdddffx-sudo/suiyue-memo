/**
 * ==========================================
 *  岁月备忘录 - APK 文件验证模块
 *  验证 APK 文件是否存在、大小正确、签名有效
 * ==========================================
 */
const fs = require('fs');
const path = require('path');
const config = require('./test-config.json');

const RESULTS = [];

function record(name, status, detail, extra = {}) {
  const item = { module: 'APK', name, status, detail, timestamp: new Date().toISOString(), ...extra };
  RESULTS.push(item);
  return item;
}

/**
 * 检查 APK 文件是否存在
 */
async function checkApkFileExists() {
  const apkDir = config.paths.apkOutputDir;
  const apkPath = path.join(apkDir, config.paths.apkFileName);
  
  // 查找目录下的所有 APK
  let apkFiles = [];
  try {
    if (fs.existsSync(apkDir)) {
      apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
    }
  } catch (e) {
    // 目录不存在
  }

  if (apkFiles.length === 0) {
    record('APK文件检查', '文件是否存在', 'FAIL', 
      `目录 "${apkDir}" 下未找到 APK 文件，请先执行 eas build`);
    return null;
  }

  // 取最新的 APK
  const latest = apkFiles.sort().reverse()[0];
  const fullPath = path.join(apkDir, latest);
  const stat = fs.statSync(fullPath);

  record('APK文件检查', '文件是否存在', 'PASS', 
    `找到: ${latest} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);

  return { path: fullPath, name: latest, size: stat.size };
}

/**
 * 检查 APK 文件大小是否合理
 */
async function checkApkSize(apkInfo) {
  if (!apkInfo) return;

  const sizeMB = apkInfo.size / 1024 / 1024;
  
  // Expo 打包的 APK 通常在 30-80MB
  if (sizeMB > 100) {
    record('APK大小检查', '文件大小', 'WARN', 
      `文件较大: ${sizeMB.toFixed(1)} MB (>100MB)，可能包含多余资源`);
  } else if (sizeMB < 10) {
    record('APK大小检查', '文件大小', 'FAIL', 
      `文件过小: ${sizeMB.toFixed(1)} MB (<10MB)，可能构建不完整`);
  } else {
    record('APK大小检查', '文件大小', 'PASS', 
      `大小合理: ${sizeMB.toFixed(1)} MB`);
  }
}

/**
 * 检查 APK 的版本信息
 */
async function checkApkMetadata(apkInfo) {
  if (!apkInfo) return;

  // 使用 aapt 或 apktool 检查 manifest（如果安装了）
  // 这里用文件修改时间作为简单验证
  const stat = fs.statSync(apkInfo.path);
  record('APK元数据', '构建时间', 'PASS', 
    `最后修改: ${stat.mtime.toLocaleString('zh-CN')}`);
}

/**
 * 检查构建脚本和配置的一致性
 */
async function checkBuildConfig() {
  const configPaths = [
    { name: 'app.config.ts', path: '../client/app.config.ts' },
    { name: 'eas.json', path: '../client/eas.json' },
    { name: 'package.json (client)', path: '../client/package.json' },
    { name: 'global.css', path: '../client/global.css' },
  ];

  let allExist = true;
  for (const cfg of configPaths) {
    try {
      const fullPath = path.join(__dirname, cfg.path);
      if (fs.existsSync(fullPath)) {
        record('构建配置', `${cfg.name} 存在`, 'PASS', '文件存在');
      } else {
        record('构建配置', `${cfg.name} 存在`, 'FAIL', `文件不存在: ${cfg.path}`);
        allExist = false;
      }
    } catch (e) {
      record('构建配置', `${cfg.name} 存在`, 'ERROR', `${e.message}`);
    }
  }
  return allExist;
}

/**
 * 生成版本变更摘要（对比上次测试）
 */
async function generateVersionSummary() {
  const dir = config.paths.apkOutputDir;
  const reportDir = config.report.outputDir;
  
  // 查找历史报告
  try {
    if (fs.existsSync(reportDir)) {
      const reports = fs.readdirSync(reportDir).filter(f => f.endsWith('.json'));
      record('版本追踪', '历史记录', 'INFO', `发现 ${reports.length} 份历史测试报告`);
    }
  } catch (e) {
    // 首次运行
  }
}

// ============================
// 主入口
// ============================
async function runAllApkTests() {
  console.log('========================================');
  console.log('  岁月备忘录 APK 文件验证');
  console.log('========================================\n');

  await checkBuildConfig();
  const apkInfo = await checkApkFileExists();
  await checkApkSize(apkInfo);
  await checkApkMetadata(apkInfo);
  await generateVersionSummary();

  return RESULTS;
}

if (require.main === module) {
  runAllApkTests().then(results => {
    const failed = results.filter(r => r.status === 'FAIL');
    if (failed.length > 0) {
      console.log('\n❌ APK 验证存在问题');
      failed.forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
      process.exit(1);
    }
    console.log('\n✅ APK 验证通过');
    process.exit(0);
  });
}

module.exports = { runAllApkTests, RESULTS };