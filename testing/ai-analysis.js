/**
 * ==========================================
 *  岁月备忘录 - AI 智能分析报告生成器
 *  分析测试结果并输出详细的 HTML 报告
 * ==========================================
 */
const fs = require('fs');
const path = require('path');
const config = require('./test-config.json');

class AIAnalyzer {
  constructor() {
    this.reportDir = config.report.outputDir;
    this.htmlContent = '';
  }

  /**
   * 分析测试结果，给出 AI 诊断建议
   */
  analyzeResults(allResults) {
    const analysis = {
      summary: this.generateSummary(allResults),
      categories: this.categorizeResults(allResults),
      recommendations: this.generateRecommendations(allResults),
      trendData: this.getTrendData(),
    };
    return analysis;
  }

  /**
   * 生成总体摘要
   */
  generateSummary(results) {
    const critical = results.filter(r => r.critical);
    const failed = results.filter(r => r.status === 'FAIL');
    const warnings = results.filter(r => r.status === 'WARN');
    const passed = results.filter(r => r.status === 'PASS');
    const errors = results.filter(r => r.status === 'ERROR');

    const total = results.length;
    let score = 100;
    score -= critical.length * 15;
    score -= errors.length * 10;
    score -= failed.length * 8;
    score -= warnings.length * 3;
    score = Math.max(0, score);

    let verdict = '优秀';
    let color = '#4CAF50';
    if (score < 60) { verdict = '不通过'; color = '#F44336'; }
    else if (score < 75) { verdict = '需改进'; color = '#FF9800'; }
    else if (score < 90) { verdict = '良好'; color = '#2196F3'; }

    return {
      total,
      passed: passed.length,
      warnings: warnings.length,
      failed: failed.length,
      critical: critical.length,
      errors: errors.length,
      score,
      verdict,
      color,
      timestamp: new Date().toLocaleString('zh-CN'),
    };
  }

  /**
   * 按模块分类结果
   */
  categorizeResults(results) {
    const categories = {};
    for (const r of results) {
      if (!categories[r.module]) categories[r.module] = [];
      categories[r.module].push(r);
    }
    return categories;
  }

  /**
   * 生成推荐修复建议
   */
  generateRecommendations(results) {
    const recs = [];

    const critical = results.filter(r => r.critical);
    const failed = results.filter(r => r.status === 'FAIL');

    // 关键问题
    for (const c of critical) {
      recs.push({
        type: 'critical',
        icon: '🔴',
        title: `严重: ${c.name}`,
        detail: c.detail,
        action: this.getActionForFailure(c),
      });
    }

    // 一般失败
    for (const f of failed) {
      recs.push({
        type: 'failed',
        icon: '❌',
        title: `失败: ${f.name}`,
        detail: f.detail,
        action: this.getActionForFailure(f),
      });
    }

    // 警告
    const warns = results.filter(r => r.status === 'WARN');
    for (const w of warns) {
      recs.push({
        type: 'warning',
        icon: '⚠️',
        title: `警告: ${w.name}`,
        detail: w.detail,
        action: '建议关注，但不影响核心功能',
      });
    }

    // 通用建议
    if (results.length > 0) {
      recs.push({
        type: 'info',
        icon: '💡',
        title: 'vivo 手表推送确认',
        detail: '请确认 vivo 手机已开启「设置 > 通知与状态栏 > 应用通知 > 岁月备忘录」中所有通知权限',
        action: '手动确认系统设置',
      });
      recs.push({
        type: 'info',
        icon: '💡',
        title: '自启动与后台白名单',
        detail: 'vivo/iQOO 手机需在「设置 > 电池 > 后台耗电管理」中将 APP 设为「允许后台高耗电」',
        action: 'APP 内已提供一键跳转功能，进入「设置页」点击优化',
      });
    }

    return recs;
  }

  /**
   * 根据失败类型给出具体修复措施
   */
  getActionForFailure(item) {
    const name = item.name || '';
    const detail = item.detail || '';

    if (name.includes('健康检查') || name.includes('服务未启动')) {
      return '请执行 cd server && pnpm run dev 启动后端服务';
    }
    if (name.includes('路由注册')) {
      return '检查 server/src/index.ts 中 express.Router() 是否正确注册';
    }
    if (name.includes('APK')) {
      return '执行 cd client && npx eas build --platform android --profile preview 重新打包';
    }
    if (name.includes('崩溃')) {
      return '查看 logcat 完整日志定位崩溃位置，检查 null/undefined 访问';
    }
    if (name.includes('截图')) {
      return '检查 LDPlayer 是否正常显示画面，或等待时间是否足够';
    }

    return `请检查相关代码: ${detail}`;
  }

  /**
   * 获取历史趋势数据
   */
  getTrendData() {
    try {
      if (fs.existsSync(this.reportDir)) {
        const files = fs.readdirSync(this.reportDir)
          .filter(f => f.endsWith('.json'))
          .map(f => ({
            time: fs.statSync(path.join(this.reportDir, f)).mtime,
            file: f
          }))
          .sort((a, b) => a.time - b.time);

        return files.map(f => {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(this.reportDir, f), 'utf-8'));
            return {
              timestamp: f.time.toISOString(),
              score: data.summary?.score || 0,
              passed: data.summary?.passed || 0,
              failed: data.summary?.failed || 0,
            };
          } catch { return null; }
        }).filter(Boolean);
      }
    } catch {}
    return [];
  }

  /**
   * 生成完整 HTML 报告
   */
  generateHTMLReport(analysis) {
    const { summary, categories, recommendations } = analysis;

    // 构建分类表格
    let categoryHTML = '';
    for (const [module, items] of Object.entries(categories)) {
      categoryHTML += `
        <div class="category">
          <h3>📁 ${module}</h3>
          <table>
            <tr><th>测试项</th><th>状态</th><th>详情</th></tr>
            ${items.map(item => `
              <tr class="row-${item.status.toLowerCase()}">
                <td>${item.name}</td>
                <td class="status-${item.status.toLowerCase()}">${item.status}</td>
                <td>${item.detail}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    // 构建建议列表
    let recHTML = '';
    for (const rec of recommendations) {
      recHTML += `
        <div class="rec rec-${rec.type}">
          <strong>${rec.icon} ${rec.title}</strong>
          <p>${rec.detail}</p>
          <code>推荐操作: ${rec.action}</code>
        </div>
      `;
    }

    // 趋势图
    let trendHTML = '';
    if (analysis.trendData.length > 1) {
      const labels = analysis.trendData.map(d => {
        const t = new Date(d.timestamp);
        return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
      }).join(',');
      const scores = analysis.trendData.map(d => d.score).join(',');

      trendHTML = `
        <div class="trend">
          <h3>📈 测试分数趋势</h3>
          <div class="chart-bars">
            ${analysis.trendData.map((d, i) => `
              <div class="bar-item">
                <div class="bar" style="height: ${d.score}%; background: ${d.score > 80 ? '#4CAF50' : d.score > 60 ? '#FF9800' : '#F44336'}">
                  <span>${d.score}</span>
                </div>
                <div class="bar-label">${new Date(d.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    this.htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>岁月备忘录 - 自动测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
      font-size: 20px; /* 适老化字体 */
    }
    .container { max-width: 900px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1a237e, #283593);
      color: white;
      padding: 40px;
      border-radius: 20px;
      margin-bottom: 24px;
    }
    .header h1 { font-size: 36px; margin-bottom: 8px; }
    .header .subtitle { font-size: 20px; opacity: 0.8; }
    .score-card {
      background: white;
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .score-big {
      font-size: 64px;
      font-weight: bold;
      text-align: center;
      padding: 16px;
    }
    .score-detail { display: flex; justify-content: center; gap: 32px; margin-top: 16px; }
    .score-detail span { font-size: 22px; }
    .pass { color: #4CAF50; } .warn { color: #FF9800; } .fail { color: #F44336; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 18px;
    }
    th { background: #f0f0f0; padding: 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .row-pass td { background: #f1f8e9; }
    .row-fail td { background: #ffebee; }
    .row-warn td { background: #fff8e1; }
    .row-error td { background: #fce4ec; }
    .row-info td { background: #e8eaf6; }
    .status-pass { color: #4CAF50; font-weight: bold; }
    .status-fail { color: #F44336; font-weight: bold; }
    .status-warn { color: #FF9800; font-weight: bold; }
    .status-error { color: #F44336; font-weight: bold; }
    .status-info { color: #2196F3; font-weight: bold; }
    .category {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .category h3 { font-size: 24px; margin-bottom: 12px; }
    .rec {
      padding: 16px 20px;
      border-radius: 12px;
      margin-bottom: 12px;
      font-size: 18px;
    }
    .rec-critical { background: #ffebee; border-left: 4px solid #F44336; }
    .rec-failed { background: #fff3e0; border-left: 4px solid #FF9800; }
    .rec-warning { background: #fff8e1; border-left: 4px solid #FFC107; }
    .rec-info { background: #e8eaf6; border-left: 4px solid #3F51B5; }
    .rec code { display: block; margin-top: 8px; padding: 8px 12px; background: #f5f5f5; border-radius: 8px; }
    .chart-bars { display: flex; align-items: flex-end; gap: 16px; height: 200px; padding: 20px 0; }
    .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .bar { width: 100%; max-width: 60px; border-radius: 8px 8px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; transition: height 0.3s; }
    .bar span { color: white; font-weight: bold; font-size: 14px; }
    .bar-label { font-size: 12px; margin-top: 4px; color: #666; }
    .footer { text-align: center; padding: 32px; color: #999; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 岁月备忘录</h1>
      <div class="subtitle">自动化测试报告 | ${summary.timestamp}</div>
    </div>

    <div class="score-card">
      <div class="score-big" style="color: ${summary.color}">${summary.score} 分</div>
      <div style="text-align: center; font-size: 28px; font-weight: bold; color: ${summary.color}">${summary.verdict}</div>
      <div class="score-detail">
        <span class="pass">✅ ${summary.passed} 通过</span>
        <span class="warn">⚠️ ${summary.warnings} 警告</span>
        <span class="fail">❌ ${summary.failed} 失败</span>
        <span class="fail" style="font-weight: bold">🔴 ${summary.critical} 严重</span>
      </div>
      <div class="score-detail">
        <span>总计 ${summary.total} 项测试</span>
      </div>
    </div>

    ${trendHTML}

    <div class="category">
      <h3>📋 各模块测试明细</h3>
    </div>
    ${categoryHTML}

    <div class="category">
      <h3>💡 AI 诊断建议（${recommendations.length} 条）</h3>
      ${recHTML}
    </div>

    <div class="footer">
      岁月备忘录 v${config.version} | 测试工具 | ${new Date().toLocaleString('zh-CN')}
    </div>
  </div>
</body>
</html>`;

    return this.htmlContent;
  }

  /**
   * 保存报告
   */
  saveReport(analysis, allResults) {
    // 确保报告目录存在
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    // 保存 JSON 数据
    const timestamp = Date.now();
    const jsonFile = path.join(this.reportDir, `report-${timestamp}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify({
      timestamp,
      summary: analysis.summary,
      results: allResults,
      recommendations: analysis.recommendations,
    }, null, 2));

    // 生成 HTML
    this.generateHTMLReport(analysis);
    const htmlFile = path.join(this.reportDir, `report-${timestamp}.html`);
    fs.writeFileSync(htmlFile, this.htmlContent);

    return { jsonFile, htmlFile };
  }
}

// ============================
// 主入口
// ============================
function runAnalysis(allResults) {
  console.log('========================================');
  console.log('  AI 智能分析报告生成');
  console.log('========================================\n');

  const analyzer = new AIAnalyzer();
  const analysis = analyzer.analyzeResults(allResults);
  const saved = analyzer.saveReport(analysis, allResults);

  console.log(`📊 测试评分: ${analysis.summary.score}/100 (${analysis.summary.verdict})`);
  console.log(`✅ 通过: ${analysis.summary.passed}`);
  console.log(`❌ 失败: ${analysis.summary.failed}`);
  console.log(`⚠️ 警告: ${analysis.summary.warnings}`);
  console.log(`🔴 严重: ${analysis.summary.critical}`);
  console.log(`\n💡 AI 诊断建议: ${analysis.recommendations.length} 条`);
  
  for (const rec of analysis.recommendations) {
    if (rec.type === 'critical' || rec.type === 'failed') {
      console.log(`  ${rec.icon} ${rec.title}`);
    }
  }

  console.log(`\n📁 报告已保存:`);
  console.log(`   📄 HTML: ${saved.htmlFile}`);
  console.log(`   📄 JSON: ${saved.jsonFile}`);

  return { analysis, saved };
}

if (require.main === module) {
  // 从命令行传入的 JSON 文件读取结果
  const resultFile = process.argv[2];
  if (resultFile && fs.existsSync(resultFile)) {
    const data = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
    runAnalysis(data.results || data);
  } else {
    console.log('用法: node ai-analysis.js <测试结果JSON文件>');
    console.log('或者通过程序调用 runAnalysis(results)');
    process.exit(1);
  }
}

module.exports = { AIAnalyzer, runAnalysis };