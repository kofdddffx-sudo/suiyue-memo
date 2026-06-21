/**
 * ==========================================
 *  岁月备忘录 - 全量自动化测试主入口
 *  一键运行所有测试并生成 AI 分析报告
 * ==========================================
 * 
 * 使用方法：
 *   node run-all-tests.js              # 运行所有测试（API + APK + 模拟器）
 *   node run-all-tests.js api           # 仅测试 API
 *   node run-all-tests.js apk           # 仅验证 APK 文件
 *   node run-all-tests.js emulator      # 仅模拟器测试（需已安装 LDPlayer）
 *   node run-all-tests.js report        # 仅查看最近报告
 * 
 * 完整流程（推荐）：
 *   1. eas build --platform android --profile preview  (打包 APK)
 *   2. copy APK 到 E:\其他\岁月APP\
 *   3. node run-all-tests.js                            (一键全测)
 */

const fs = require('fs');
const path = require('path');
const config = require('./test-config.json');

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';

  const allResults = [];
  const reportDir = config.report.outputDir;

  console.log(`
╔══════════════════════════════════════════╗
║         📋 岁月备忘录 自动化测试          ║
║    ${new Date().toLocaleString('zh-CN')}              ║
╚══════════════════════════════════════════╝
  `.trim());

  // ============================
  // 阶段 1: API 测试
  // ============================
  if (mode === 'all' || mode === 'api') {
    console.log('\n📌 阶段 1/3: API 接口测试\n');
    try {
      const apiTester = require('./test-api.js');
      const apiResults = await apiTester.runAllApiTests();
      allResults.push(...apiResults);
    } catch (err) {
      console.error('API 测试异常:', err.message);
      allResults.push({
        module: 'API', name: '测试框架', status: 'ERROR',
        detail: `脚本执行异常: ${err.message}`, timestamp: new Date().toISOString(), critical: true
      });
    }
  }

  // ============================
  // 阶段 2: APK 文件验证
  // ============================
  if (mode === 'all' || mode === 'apk') {
    console.log('\n📌 阶段 2/3: APK 文件验证\n');
    try {
      const apkTester = require('./test-apk.js');
      const apkResults = await apkTester.runAllApkTests();
      allResults.push(...apkResults);
    } catch (err) {
      console.error('APK 验证异常:', err.message);
      allResults.push({
        module: 'APK', name: '测试框架', status: 'ERROR',
        detail: `脚本执行异常: ${err.message}`, timestamp: new Date().toISOString()
      });
    }
  }

  // ============================
  // 阶段 3: 模拟器测试
  // ============================
  if (mode === 'all' || mode === 'emulator') {
    console.log('\n📌 阶段 3/3: 雷电模拟器测试\n');

    // 检查 LDPlayer 是否可用
    const ldPath = config.paths.ldplayer.installPath;
    let ldAvailable = false;
    try { ldAvailable = fs.existsSync(ldPath); } catch {}

    if (ldAvailable) {
      try {
        const emulatorTester = require('./test-ldplayer.js');
        const emuResults = await emulatorTester.runAllEmulatorTests();
        allResults.push(...emuResults);
      } catch (err) {
        console.error('模拟器测试异常:', err.message);
        allResults.push({
          module: 'LDPlayer', name: '测试框架', status: 'ERROR',
          detail: `脚本执行异常: ${err.message}`, timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('   ⚠️  未检测到 LDPlayer4，跳过模拟器测试');
      console.log(`   (如需测试，请确认 ${ldPath} 存在)`);
      allResults.push({
        module: 'LDPlayer', name: '环境检查', status: 'SKIP',
        detail: `LDPlayer4 未安装 (${ldPath})`, timestamp: new Date().toISOString()
      });
    }
  }

  // ============================
  // 生成 AI 分析报告
  // ============================
  console.log('\n📌 正在生成 AI 分析报告...\n');
  try {
    const analyzer = require('./ai-analysis.js');
    const { analysis, saved } = analyzer.runAnalysis(allResults);

    // 保存测试结果汇总
    const summaryFile = path.join(reportDir, `report-${Date.now()}.json`);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(summaryFile, JSON.stringify({
      summary: analysis.summary,
      timestamp: Date.now(),
      results: allResults
    }, null, 2));

    console.log(`\n✅ 测试完成！报告已保存至: ${reportDir}`);
  } catch (err) {
    console.error('报告生成异常:', err.message);
  }

  // ============================
  // 最终结果
  // ============================
  const critical = allResults.filter(r => r.critical);
  const failed = allResults.filter(r => r.status === 'FAIL');
  const errors = allResults.filter(r => r.status === 'ERROR');

  console.log('\n' + '='.repeat(50));
  if (critical.length > 0 || failed.length > 0) {
    console.log(`\n❌ 测试完成，存在 ${critical.length + failed.length} 项问题需要修复`);
    console.log(`   请查看报告了解详情`);
    console.log(`   报告位置: ${reportDir}`);
    process.exit(1);
  } else {
    console.log(`\n✅ 所有测试通过！APK 可用`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('运行时异常:', err);
  process.exit(1);
});