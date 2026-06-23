import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { LLMClient, ASRClient, Config, HeaderUtils } from "coze-coding-dev-sdk";

const app = express();
const port = process.env.PORT || 9091;

// ============================================================
// Middleware
// ============================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 文件上传中间件（用于接收语音文件）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ============================================================
// LLM 客户端初始化
// ============================================================

let llmClient: LLMClient | null = null;

function getLLMClient(): LLMClient {
  if (!llmClient) {
    const config = new Config();
    llmClient = new LLMClient(config);
  }
  return llmClient;
}

// ============================================================
// 健康检查
// ============================================================

app.get('/api/v1/health', (req, res) => {
  console.log('[Health] Check success');
  res.status(200).json({ status: 'ok', service: '岁月备忘录 API' });
});

// ============================================================
// [核心接口] AI 任务解析
// POST /api/v1/parse-task
//
// 接收用户的语音识别文本，通过 LLM 解析为结构化任务数据
//
// 请求体: { text: string }
// 响应体: {
//   task: string,        // 任务标题
//   time: string,        // 提醒时间 "HH:mm"
//   repeat: string,      // 重复类型 "none" | "daily" | "weekly"
//   confidence: number   // 置信度 0-1
// }
//
// 🔧 您可以将此接口替换为扣子 Coze Bot API 调用
// ============================================================

app.post('/api/v1/parse-task', async (req, res) => {
  const { text } = req.body;
  try {

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供待解析的文本' });
    }

    console.log('[ParseTask] 收到文本:', text);

    // ── 调用 LLM 解析任务 ──
    // 使用 System Prompt 引导模型输出结构化 JSON
    const messages = [
      {
        role: "system" as const,
        content: `你是一个智能日程管家，负责将老人的语音描述解析为结构化的提醒任务。

你的任务是分析用户输入的文本，提取以下信息：
1. task: 核心任务描述（简洁明了，如"给孙子冲奶粉"、"吃药"）
2. time: 提醒时间，24小时制 "HH:mm" 格式。如果用户说"下午3点"，返回 "15:00"；如果没说具体时间，预估一个合理时间（默认上午9:00）
3. repeat: 重复类型。"daily" = 每天，"weekly" = 每周，"none" = 不重复
4. confidence: 你对解析结果的自信程度，0.0 到 1.0 之间的数字

规则：
- 如果文本中明确说"每天"、"每天早上"等，repeat 设为 "daily"
- 如果文本中明确说"每周"、"每个星期"等，repeat 设为 "weekly"
- 否则 repeat 设为 "none"
- 始终只返回 JSON 格式，不要包含其他文字
- JSON 格式示例：{"task": "给孙子冲奶粉", "time": "15:00", "repeat": "daily", "confidence": 0.9}`,
      },
      { role: "user" as const, content: text },
    ];

    const client = getLLMClient();
    console.log('[ParseTask] LLM 客户端已创建，正在调用...');
    const response = await client.invoke(messages, {
      model: "doubao-seed-2-0-mini-260215",
      temperature: 0.3,
      streaming: false,
    });

    console.log('[ParseTask] LLM 响应类型:', typeof response, response ? Object.keys(response).join(',') : 'null');

    if (!response || !response.content) {
      console.warn('[ParseTask] LLM 返回为空，使用默认值');
      return res.json({
        task: text,
        time: '09:00',
        repeat: 'none',
        confidence: 0.3,
      });
    }

    // ── 解析 JSON ──
    // LLM 可能会在 JSON 前后添加 ```json 标记，需要清理
    let jsonStr = response.content.trim();
    // 移除可能的 markdown 代码块标记
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    jsonStr = jsonStr.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      const result = {
        task: parsed.task || text,
        time: parsed.time || '09:00',
        repeat: parsed.repeat || 'none',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };

      console.log('[ParseTask] 解析结果:', JSON.stringify(result));
      res.json(result);
    } catch (parseError) {
      // 如果 JSON 解析失败，返回默认结构
      console.warn('[ParseTask] JSON 解析失败，使用默认值:', jsonStr);
      res.json({
        task: text,
        time: '09:00',
        repeat: 'none',
        confidence: 0.3,
      });
    }
  } catch (error: any) {
    console.error('[ParseTask] 调用失败:', error?.message || '未知错误', error?.stack || '');
    // 即使 LLM 调用失败，也返回默认解析结果（容错设计）
    res.json({
      task: text,
      time: '09:00',
      repeat: 'none',
      confidence: 0.3,
    });
  }
});

// ============================================================
// [核心接口] 语音转文字 (ASR)
// POST /api/v1/speech-to-text
//
// 使用 coze-coding-dev-sdk 的 ASRClient 进行语音识别
// 接收前端上传的音频文件，转为 base64 后调用 ASR 服务
// ============================================================

app.post('/api/v1/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: '请上传音频文件' });
    }

    console.log('[ASR] 收到音频:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // ── 将音频 buffer 转为 base64 ──
    const audioBase64 = file.buffer.toString('base64');

    // ── 提取转发 headers ──
    const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);

    // ── 调用 ASR SDK ──
    const config = new Config();
    const asrClient = new ASRClient(config, customHeaders);

    console.log('[ASR] 正在调用语音识别服务...');
    const result = await asrClient.recognize({
      uid: 'suiyue_user',
      base64Data: audioBase64,
    });

    const recognizedText = result.text || '';
    console.log('[ASR] 识别结果:', recognizedText);

    res.json({
      text: recognizedText,
      duration: result.duration || 0,
    });
  } catch (error: any) {
    console.error('[ASR] 处理失败:', error.message);
    res.status(500).json({ error: '语音识别失败', message: error.message, text: '' });
  }
});

// ============================================================
// 错误处理中间件
// ============================================================

// multer 文件大小错误
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: '音频文件大小超过限制（最大 50MB）' });
    }
    return res.status(400).json({ error: `文件上传错误: ${err.message}` });
  }
  next(err);
});

// 通用错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] 未捕获错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// ============================================================
// 下载项目代码
// ============================================================

// 下载页面（HTML 方式方便直接点击下载）
app.get('/api/v1/download-page', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>岁月备忘录 - 下载项目代码</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: #1a1a2e; color: #fff;
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #16213e; border-radius: 24px; padding: 48px;
      max-width: 560px; width: 90%; text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .sub { color: #aaa; font-size: 16px; margin-bottom: 32px; }
    .size { color: #4fc3f7; font-size: 14px; margin-bottom: 8px; }
    .btn {
      display: inline-block; padding: 18px 56px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff; text-decoration: none; border-radius: 16px;
      font-size: 20px; font-weight: bold;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 8px 24px rgba(102,126,234,0.4);
      margin-bottom: 24px;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(102,126,234,0.6); }
    .info { text-align: left; background: #0f3460; border-radius: 12px; padding: 20px; margin-top: 24px; }
    .info h3 { font-size: 16px; margin-bottom: 12px; color: #e94560; }
    .info p { font-size: 14px; color: #ccc; line-height: 1.8; }
    .info code { background: #1a1a2e; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📱 岁月备忘录</h1>
    <p class="sub">适老化智能提醒APP · 完整项目代码</p>
    <p class="size">📦 压缩包大小: 约 550KB（不含 node_modules）</p>
    <a class="btn" href="/api/v1/download-zip">⬇ 下载项目代码 (ZIP格式，Windows直接解压)</a>
    <br><br>
    <a class="btn" href="/api/v1/download-packtool" style="background: linear-gradient(135deg, #e94560, #c23152); font-size: 16px; padding: 14px 36px;">🔧 下载通用打包工具 pack-tool</a>
    <div class="info">
      <h3>⚠ 下载后使用步骤</h3>
      <p>
        1. 解压到电脑文件夹<br>
        2. 打开终端，进入 <code>client/</code> 目录<br>
        3. 执行 <code>npm install</code> 安装依赖<br>
        4. 执行 <code>npx eas build --platform android --profile preview</code> 打包 APK<br><br>
        <strong>详细教程见代码包中的 README.md</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 文件下载接口 - 项目代码（ZIP格式，Windows友好）
app.get('/api/v1/download', (req, res) => {
  const zipPath = '/tmp/suiyue-app.zip';
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'suiyue-app.zip', (err) => {
      if (err) {
        console.error('[Download] 下载失败:', err.message);
        res.status(500).json({ error: '文件下载失败' });
      }
    });
  } else {
    res.status(404).json({ error: '文件未找到，请先打包' });
  }
});

// 备用下载 - tar.gz 格式
app.get('/api/v1/download-tgz', (req, res) => {
  const zipPath = '/tmp/suiyue-app.tar.gz';
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'suiyue-app.tar.gz', (err) => {
      if (err) {
        console.error('[Download] TGZ下载失败:', err.message);
        res.status(500).json({ error: '文件下载失败' });
      }
    });
  } else {
    res.status(404).json({ error: '文件未找到，请先打包' });
  }
});

// 文件下载接口 - pack-tool 打包工具
app.get('/api/v1/download-packtool', (req, res) => {
  const zipPath = '/workspace/projects/client/public/pack-tool-bundle.tar.gz';
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'pack-tool-bundle.tar.gz', (err) => {
      if (err) {
        console.error('[Download] pack-tool 下载失败:', err.message);
        res.status(500).json({ error: '文件下载失败' });
      }
    });
  } else {
    res.status(404).json({ error: '文件未找到' });
  }
});

// 文件下载接口 - ZIP 格式（Windows 友好）
app.get('/api/v1/download-zip', (req, res) => {
  const zipPath = '/tmp/suiyue-app.zip';
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'suiyue-app.zip', (err) => {
      if (err) {
        console.error('[Download] ZIP下载失败:', err.message);
        res.status(500).json({ error: '文件下载失败' });
      }
    });
  } else {
    res.status(404).json({ error: 'ZIP文件未找到' });
  }
});

// ============================================================
// 岁月备忘录 Web 版路由
// ============================================================

// 静态文件：PWA manifest + Service Worker + 图标
app.use('/app', express.static('/workspace/projects/server/public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

// 岁月备忘录 Web 版入口
app.get('/app', (req, res) => {
  const htmlPath = '/workspace/projects/server/public/memory-app.html';
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send('应用文件未找到');
  }
});

// 根路径重定向到 Web 版
app.get('/', (req, res) => {
  res.redirect('/app');
});

// ============================================================
// 启动服务
// ============================================================

app.listen(port, () => {
  console.log(`[岁月备忘录] API 服务运行于 http://localhost:${port}/`);
  console.log(`[岁月备忘录] 健康检查: http://localhost:${port}/api/v1/health`);
  console.log(`[岁月备忘录] 任务解析: POST /api/v1/parse-task`);
  console.log(`[岁月备忘录] 语音识别: POST /api/v1/speech-to-text (预留接口)`);
});