import express from "express";
import cors from "cors";
import multer from "multer";
import { LLMClient, Config } from "coze-coding-dev-sdk";

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
// [预留接口] 语音转文字 (ASR)
// POST /api/v1/speech-to-text
//
// 🔧 此接口为预留接口，您可在此接入扣子 Coze Bot 的语音识别能力
// 或替换为其他 ASR 服务（如讯飞、阿里云等）
//
// 当前实现：仅返回占位响应，可直接被替换
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

    // ── 预留：后续在此接入 ASR 服务 ──
    // TODO: 接入扣子 Coze Bot API 进行语音识别
    // 您可以参考以下流程：
    // 1. 将 file.buffer 上传到扣子 Bot
    // 2. 调用 Bot 的语音识别接口
    // 3. 将识别结果返回给前端

    // 当前返回占位响应
    res.json({
      text: '',  // 此处应返回识别后的文本
      note: '语音识别功能待接入，请配置扣子 Coze Bot API',
      fileInfo: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
      },
    });
  } catch (error: any) {
    console.error('[ASR] 处理失败:', error.message);
    res.status(500).json({ error: '语音识别失败', message: error.message });
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
// 启动服务
// ============================================================

app.listen(port, () => {
  console.log(`[岁月备忘录] API 服务运行于 http://localhost:${port}/`);
  console.log(`[岁月备忘录] 健康检查: http://localhost:${port}/api/v1/health`);
  console.log(`[岁月备忘录] 任务解析: POST /api/v1/parse-task`);
  console.log(`[岁月备忘录] 语音识别: POST /api/v1/speech-to-text (预留接口)`);
});