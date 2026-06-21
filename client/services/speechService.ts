/**
 * speechService.ts - 语音播报服务（TTS）
 *
 * 职责：
 * - AI 解析任务后，用语音向老人播报确认
 * - 例如："已为您设置下午3点给孙子冲奶粉的提醒"
 *
 * 使用 expo-speech 实现文字转语音
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// ============================================================
// 语音播报
// ============================================================

/**
 * 播报任务创建确认语音
 * 在 AI 解析完成后调用，让老人听到确认信息
 *
 * @param taskTitle  任务标题
 * @param time       提醒时间（如 "15:00"）
 * @param repeat     重复类型
 */
export function speakTaskConfirmation(taskTitle: string, time: string, repeat: string) {
  // 格式化时间显示
  const [hours, minutes] = time.split(':').map(Number);
  const timeText = `${hours}点${minutes > 0 ? minutes + '分' : ''}`;

  // 构建播报文本（口语化、慢速）
  let text = `已为您设置提醒。${timeText}，${taskTitle}`;

  if (repeat === 'daily') {
    text += '。这个提醒会每天重复。';
  } else if (repeat === 'weekly') {
    text += '。这个提醒会每周重复。';
  } else {
    text += '。这个提醒只提醒一次。';
  }

  speakText(text);
}

/**
 * 播报任务完成确认语音
 */
export function speakTaskComplete(taskTitle: string) {
  speakText(`好的，已将「${taskTitle}」标记为完成。`);
}

/**
 * 播报任务取消语音
 */
export function speakTaskCancelled(taskTitle: string) {
  speakText(`已为您取消「${taskTitle}」的提醒。`);
}

/**
 * 语音提示"请说话"
 */
export function speakPleaseSpeak() {
  speakText('请说出您要记住的事情');
}

/**
 * 语音提示"录音已结束"
 */
export function speakRecordingStopped() {
  speakText('好的，正在为您解析');
}

// ============================================================
// 核心 TTS 方法
// ============================================================

/**
 * 使用系统 TTS 播报指定文本
 *
 * @param text  要播报的文本
 * @param rate  语速 (0.0 ~ 1.0)，老年人建议慢速 0.6~0.75
 */
export async function speakText(text: string, rate: number = 0.7) {
  try {
    // 先停止正在播放的语音（防止重叠）
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      Speech.stop();
    }

    // 等待一下让停止生效
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 开始播报
    await Speech.speak(text, {
      language: 'zh-CN',
      rate,           // 语速稍慢，适合老年人
      pitch: 1.0,     // 音调正常
      volume: 1.0,    // 最大音量
    });
  } catch (error) {
    console.error('语音播报失败:', error);
  }
}

/**
 * 停止当前播报
 */
export function stopSpeaking() {
  try {
    Speech.stop();
  } catch (error) {
    console.error('停止播报失败:', error);
  }
}