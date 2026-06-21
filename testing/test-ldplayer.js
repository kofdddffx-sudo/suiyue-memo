/**
 * ==========================================
 *  岁月备忘录 - 雷电模拟器自动化测试脚本
 *  自动启动 LDPlayer4，安装 APK，截图测试
 * ==========================================
 */
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./test-config.json');

const RESULTS = [];

function record(name, status, detail, extra = {}) {
  const item = { module: 'LDPlayer', name, status, detail, timestamp: new Date().toISOString(), ...extra };
  RESULTS.push(item);
  return item;
}

/**
 * 运行 CMD 命令并返回输出
 */
function runCmd(cmd, timeout = 30000) {
  try {
    const output = execSync(cmd, { 
      timeout, 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, output: err.stdout?.trim() || '', error: err.stderr?.trim() || err.message };
  }
}

/**
 * 等待指定毫秒
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================
// 1. 检查 LDPlayer 是否已安装
// ============================
function checkLDPlayerInstalled() {
  const ldPath = config.paths.ldplayer.installPath;
  const adbPath = config.paths.ldplayer.adbPath;

  // 检查 LDPlayer 主程序
  if (fs.existsSync(ldPath)) {
    record('环境检查', 'LDPlayer 主程序', 'PASS', `已安装: ${ldPath}`);
  } else {
    record('环境检查', 'LDPlayer 主程序', 'FAIL', `未找到: ${ldPath}\n  请确认 LDPlayer4 已安装`);
    return false;
  }

  // 检查 ADB
  if (fs.existsSync(adbPath)) {
    record('环境检查', 'ADB 工具', 'PASS', `已安装: ${adbPath}`);
  } else {
    record('环境检查', 'ADB 工具', 'FAIL', `未找到: ${adbPath}`);
    return false;
  }

  // 检查 adb 版本
  const adbVer = runCmd(`"${adbPath}" version`);
  if (adbVer.ok) {
    record('环境检查', 'ADB 版本', 'PASS', adbVer.output.split('\n')[0]);
  }

  return true;
}

// ============================
// 2. 启动 LDPlayer 并等待就绪
// ============================
async function startLDPlayer() {
  const ldPath = config.paths.ldplayer.installPath;
  
  record('模拟器', '启动 LDPlayer', 'INFO', '正在启动模拟器...');
  
  // 启动 LDPlayer（不等待返回）
  try {
    const proc = spawn(`"${ldPath}"`, ['launch', '--name', config.paths.ldplayer.emulatorName], {
      shell: true,
      detached: true,
      stdio: 'ignore'
    });
    proc.unref();
  } catch (err) {
    record('模拟器', '启动 LDPlayer', 'FAIL', `启动失败: ${err.message}`);
    return false;
  }

  // 等待模拟器启动（最多 120 秒）
  const adbPath = config.paths.ldplayer.adbPath;
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const result = runCmd(`"${adbPath}" devices`);
    if (result.ok && result.output.includes('emulator')) {
      record('模拟器', '启动 LDPlayer', 'PASS', `模拟器已就绪 (启动耗时约${(i + 1) * 5}秒)`);
      return true;
    }
    if (i % 4 === 3) {
      console.log(`  等待模拟器启动中... (${(i + 1) * 5}s)`);
    }
  }

  record('模拟器', '启动 LDPlayer', 'FAIL', '模拟器启动超时 (120s)');
  return false;
}

// ============================
// 3. 安装 APK
// ============================
async function installApk(apkPath) {
  const adbPath = config.paths.ldplayer.adbPath;
  const fullApkPath = path.resolve(apkPath);
  
  record('安装', 'APK 安装', 'INFO', `正在安装: ${path.basename(fullApkPath)}...`);

  const result = runCmd(`"${adbPath}" install -r "${fullApkPath}"`, 120000);
  
  if (result.ok) {
    if (result.output.includes('Success')) {
      record('安装', 'APK 安装', 'PASS', `${path.basename(fullApkPath)} 安装成功`);
      return true;
    } else {
      record('安装', 'APK 安装', 'WARN', `安装可能异常: ${result.output}`);
      return true;
    }
  } else {
    record('安装', 'APK 安装', 'FAIL', `安装失败: ${result.error}`);
    return false;
  }
}

// ============================
// 4. 启动 APP 并截图
// ============================
async function launchAndScreenshot(apkInfo) {
  const adbPath = config.paths.ldplayer.adbPath;
  const packageName = config.packageName;
  const reportDir = config.report.outputDir;
  
  // 创建报告目录
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // 启动 APP
  record('启动', 'APP 启动', 'INFO', '正在启动 APP...');
  const launchResult = runCmd(
    `"${adbPath}" shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
    15000
  );

  // 等待首页渲染
  await sleep(3000);

  // 截图首页
  const screenshotName = `home-${Date.now()}.png`;
  const remotePath = '/sdcard/' + screenshotName;
  const localPath = path.join(reportDir, screenshotName);
  
  const screenResult = runCmd(
    `"${adbPath}" shell screencap -p ${remotePath} && "${adbPath}" pull ${remotePath} "${localPath}"`,
    15000
  );

  if (screenResult.ok && fs.existsSync(localPath)) {
    const stat = fs.statSync(localPath);
    if (stat.size > 1000) {
      record('截图', '首页截图', 'PASS', `已保存: ${localPath} (${(stat.size/1024).toFixed(1)} KB)`);
    } else {
      record('截图', '首页截图', 'WARN', '截图文件过小，可能内容不完整');
    }
    // 清理远程文件
    runCmd(`"${adbPath}" shell rm ${remotePath}`);
  } else {
    record('截图', '首页截图', 'FAIL', '截图失败');
  }

  // 获取当前 activity 信息
  const activityResult = runCmd(
    `"${adbPath}" shell dumpsys window | grep mCurrentFocus`,
    10000
  );
  if (activityResult.ok && activityResult.output.includes(packageName)) {
    record('启动', 'Activity 验证', 'PASS', `当前运行: ${activityResult.output.trim()}`);
  } else if (activityResult.ok) {
    record('启动', 'Activity 验证', 'FAIL', `APP 可能未正确启动: ${activityResult.output}`);
  }

  // 检查崩溃日志
  const logResult = runCmd(
    `"${adbPath}" logcat -d | grep -E "${packageName}" | grep -E "FATAL|CRASH|Exception" | tail -10`,
    10000
  );
  if (logResult.ok && logResult.output) {
    record('稳定性', '崩溃检测', 'FAIL', `检测到崩溃日志:\n${logResult.output}`);
  } else {
    record('稳定性', '崩溃检测', 'PASS', '未检测到崩溃');
  }
}

// ============================
// 5. 测试通知功能
// ============================
async function testNotification() {
  const adbPath = config.paths.ldplayer.adbPath;
  const packageName = config.packageName;
  
  record('通知', '通知权限', 'INFO', '检查通知权限...');

  // 检查通知权限
  const permResult = runCmd(
    `"${adbPath}" shell dumpsys package ${packageName} | grep -i notification`,
    10000
  );

  if (permResult.ok && (permResult.output.includes('granted') || permResult.output.includes('true'))) {
    record('通知', '通知权限', 'PASS', '通知权限已开启');
  } else if (permResult.ok) {
    record('通知', '通知权限', 'WARN', '通知权限可能未开启，请在系统设置中手动开启');
  }

  // 发送测试通知（通过 ADB 模拟）
  const notiResult = runCmd(
    `"${adbPath}" shell am broadcast -a android.intent.action.NOTIFICATION_TEST -n ${packageName}/.MainActivity`,
    10000
  );
  
  if (notiResult.ok) {
    record('通知', '通知广播', 'PASS', '通知广播发送成功');
  }
}

// ============================
// 6. 测试语音权限
// ============================
async function testPermissions() {
  const adbPath = config.paths.ldplayer.adbPath;
  const packageName = config.packageName;
  
  // 检查麦克风权限
  const micResult = runCmd(
    `"${adbPath}" shell dumpsys package ${packageName} | grep -A5 "requested permissions:" | grep -i "microphone\\|RECORD_AUDIO"`,
    10000
  );
  
  if (micResult.ok && micResult.output) {
    record('权限', '麦克风权限', 'PASS', '麦克风权限已声明');
  } else {
    record('权限', '麦克风权限', 'WARN', '未检测到麦克风权限声明');
  }

  // 检查前台服务权限
  const fgResult = runCmd(
    `"${adbPath}" shell dumpsys package ${packageName} | grep -A5 "requested permissions:" | grep -i "FOREGROUND_SERVICE"`,
    10000
  );
  
  if (fgResult.ok && fgResult.output) {
    record('权限', '前台服务权限', 'PASS', '前台服务权限已声明');
  } else {
    record('权限', '前台服务权限', 'WARN', '未检测到前台服务权限');
  }

  // 检查自启动权限 (vivo 专属)
  const autoStartResult = runCmd(
    `"${adbPath}" shell dumpsys package ${packageName} | grep -i "auto_start\\|START_TASKS"`,
    10000
  );
  
  if (autoStartResult.ok && autoStartResult.output) {
    record('权限', '自启动权限', 'INFO', `状态: ${autoStartResult.output}`);
  } else {
    record('权限', '自启动权限', 'INFO', '无法直接查询自启动状态，需在 vivo 系统设置中手动确认');
  }
}

// ============================
// 7. 关闭模拟器
// ============================
function closeLDPlayer() {
  const ldPath = config.paths.ldplayer.installPath;
  const result = runCmd(`"${ldPath}" quit`);
  record('模拟器', '关闭 LDPlayer', result.ok ? 'PASS' : 'INFO', '模拟器已关闭');
}

// ============================
// 主入口
// ============================
async function runAllEmulatorTests(apkPath) {
  console.log('========================================');
  console.log('  雷电模拟器自动化测试');
  console.log('========================================\n');

  // 1. 检查环境
  if (!checkLDPlayerInstalled()) {
    console.log('\n⚠️  环境不完整，请在 LDPlayer4 安装后再试');
    return RESULTS;
  }

  // 2. 查找 APK
  let targetApk = apkPath;
  if (!targetApk) {
    const apkDir = config.paths.apkOutputDir;
    if (fs.existsSync(apkDir)) {
      const files = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
      if (files.length > 0) {
        targetApk = path.join(apkDir, files.sort().reverse()[0]);
      }
    }
  }

  if (!targetApk || !fs.existsSync(targetApk)) {
    record('安装', 'APK 路径', 'FAIL', `APK 文件不存在`);
    return RESULTS;
  }

  // 3. 启动模拟器
  const started = await startLDPlayer();
  if (!started) return RESULTS;

  await sleep(2000);

  // 4. 安装 APK
  const installed = await installApk(targetApk);
  if (!installed) {
    closeLDPlayer();
    return RESULTS;
  }

  await sleep(2000);

  // 5. 启动并截图
  await launchAndScreenshot(targetApk);

  // 6. 测试通知
  await testNotification();

  // 7. 测试权限
  await testPermissions();

  // 8. 关闭模拟器
  closeLDPlayer();

  return RESULTS;
}

if (require.main === module) {
  const apkArg = process.argv[2];
  runAllEmulatorTests(apkArg).then(() => {
    const failed = RESULTS.filter(r => r.status === 'FAIL');
    if (failed.length > 0) {
      console.log(`\n❌ 模拟器测试完成，${failed.length} 项失败`);
      process.exit(1);
    }
    console.log('\n✅ 模拟器测试全部通过');
    process.exit(0);
  });
}

module.exports = { runAllEmulatorTests, RESULTS };