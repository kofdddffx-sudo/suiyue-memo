/**
 * ==========================================
 *  岁月备忘录 - API 自动化测试模块
 *  测试所有后端接口的功能正确性
 * ==========================================
 */
const axios = require('axios');
const config = require('./test-config.json');

const BASE = `${config.server.baseUrl}${config.server.apiPrefix}`;
const TEST_RESULTS = [];

// 工具：结果记录
function record(module, name, status, detail, extra = {}) {
  const item = { module, name, status, detail, timestamp: new Date().toISOString(), ...extra };
  TEST_RESULTS.push(item);
  return item;
}

// 工具：带超时的 axios
async function safeRequest(method, url, data = null, timeout = 10000) {
  try {
    const opts = { method, url, timeout, validateStatus: () => true };
    if (data && method === 'get') opts.params = data;
    if (data && (method === 'post' || method === 'put')) opts.data = data;
    const res = await axios(opts);
    return { ok: true, status: res.status, data: res.data, headers: res.headers };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================
// 1. 健康检查
// ============================
async function testHealthCheck() {
  const res = await safeRequest('get', `${BASE}/health`);
  if (res.ok && res.status === 200) {
    record('API', '健康检查', 'PASS', `状态码: ${res.status}`);
  } else if (res.ok) {
    record('API', '健康检查', 'FAIL', `期望200，实际${res.status}`);
  } else {
    record('API', '健康检查', 'ERROR', `服务未启动: ${res.error}`, { critical: true });
  }
  return res.ok && res.status === 200;
}

// ============================
// 2. 任务解析接口
// ============================
async function testParseTask() {
  const samples = [
    { text: '下午3点给孙子冲奶粉', expect: { keys: ['task', 'time', 'repeat', 'confidence'] } },
    { text: '每天早上8点吃降压药', expect: { keys: ['task', 'time', 'repeat', 'confidence'] } },
    { text: '明天晚上去公园散步', expect: { keys: ['task', 'time', 'repeat', 'confidence'] } },
    { text: '', expectError: true },
  ];

  for (const sample of samples) {
    const res = await safeRequest('post', `${BASE}/parse-task`, { text: sample.text });
    
    if (sample.expectError) {
      if (res.status === 400) {
        record('API', `解析任务-空文本`, 'PASS', '正确返回400');
      } else {
        record('API', `解析任务-空文本`, 'FAIL', `期望400，实际${res.status}`, { raw: res.data });
      }
      continue;
    }

    if (!res.ok) {
      record('API', `解析任务-${sample.text.slice(0, 10)}...`, 'ERROR', `请求失败: ${res.error}`, { critical: true });
      continue;
    }

    // 检查返回的 JSON 字段
    const missingKeys = sample.expect.keys.filter(k => !(k in (res.data || {})));
    if (res.status === 200 && missingKeys.length === 0) {
      record('API', `解析任务-${sample.text.slice(0, 10)}...`, 'PASS', 
        `task="${res.data.task}", time="${res.data.time}"`);
    } else if (res.status === 200) {
      record('API', `解析任务-${sample.text.slice(0, 10)}...`, 'WARN', 
        `缺少字段: ${missingKeys.join(', ')}`, { raw: res.data });
    } else {
      record('API', `解析任务-${sample.text.slice(0, 10)}...`, 'FAIL', 
        `状态码: ${res.status}`, { raw: res.data });
    }
  }
}

// ============================
// 3. 语音转文字接口
// ============================
async function testSpeechToText() {
  // 先测试无文件的情况（边界情况）
  const res = await safeRequest('post', `${BASE}/speech-to-text`, {});
  
  if (res.ok && res.status === 400) {
    record('API', '语音转文字-无文件', 'PASS', '正确返回400');
  } else if (res.ok) {
    record('API', '语音转文字-无文件', 'WARN', `期望400，实际${res.status}`, { raw: res.data });
  } else {
    record('API', '语音转文字-无文件', 'ERROR', `请求失败: ${res.error}`);
  }
}

// ============================
// 4. 响应时间测试
// ============================
async function testResponseTime() {
  const iterations = 5;
  let total = 0, success = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const res = await safeRequest('get', `${BASE}/health`);
    const elapsed = Date.now() - start;
    total += elapsed;
    if (res.ok) success++;
  }
  
  const avg = Math.round(total / iterations);
  const status = avg < 500 ? 'PASS' : (avg < 2000 ? 'WARN' : 'FAIL');
  record('API', '响应时间测试', status, `平均响应: ${avg}ms (${success}/${iterations} 成功)`);
}

// ============================
// 5. 路由注册检查
// ============================
async function testRouteCoverage() {
  const routes = ['/health', '/parse-task', '/speech-to-text'];
  let allFound = true;
  
  for (const route of routes) {
    const res = await safeRequest('get', `${BASE}${route}`);
    // 如果返回 404 以外的错误说明路由存在但不接受 GET，如果返回 404 则路由不存在
    if (res.ok && res.status === 404) {
      // 再试 POST
      const res2 = await safeRequest('post', `${BASE}${route}`, {});
      if (res2.ok && res2.status === 404) {
        record('API', `路由注册-${route}`, 'FAIL', '路由未注册 (404)', { critical: true });
        allFound = false;
      } else {
        record('API', `路由注册-${route}`, 'PASS', `路由已注册，返回${res2.status}`);
      }
    } else {
      record('API', `路由注册-${route}`, 'PASS', `路由已注册，返回${res.status}`);
    }
  }
  return allFound;
}

// ============================
// 主入口
// ============================
async function runAllApiTests() {
  console.log('========================================');
  console.log('  岁月备忘录 API 自动化测试');
  console.log(`  服务地址: ${BASE}`);
  console.log('========================================\n');

  // 1. 先检查服务是否存活
  const isAlive = await testHealthCheck();
  if (!isAlive) {
    console.log('❌ 服务未启动，跳过 API 测试');
    return TEST_RESULTS;
  }

  // 2. 路由注册检查
  await testRouteCoverage();

  // 3. 任务解析测试
  await testParseTask();

  // 4. 语音接口测试
  await testSpeechToText();

  // 5. 性能测试
  await testResponseTime();

  return TEST_RESULTS;
}

// 如果直接运行则执行
if (require.main === module) {
  runAllApiTests().then(results => {
    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================');
    
    const critical = results.filter(r => r.critical);
    const failed = results.filter(r => r.status === 'FAIL');
    const warnings = results.filter(r => r.status === 'WARN');
    const passed = results.filter(r => r.status === 'PASS');
    
    console.log(`  总计: ${results.length}`);
    console.log(`  ✅ 通过: ${passed.length}`);
    console.log(`  ⚠️  警告: ${warnings.length}`);
    console.log(`  ❌ 失败: ${failed.length}`);
    console.log(`  🚨 严重: ${critical.length}`);
    
    if (failed.length > 0 || critical.length > 0) {
      console.log('\n--- 失败项详情 ---');
      [...failed, ...critical].forEach(r => {
        console.log(`  [${r.module}] ${r.name}: ${r.detail}`);
      });
    }
    
    process.exit(critical.length > 0 ? 1 : 0);
  }).catch(err => {
    console.error('测试脚本异常:', err);
    process.exit(1);
  });
}

module.exports = { runAllApiTests, TEST_RESULTS };