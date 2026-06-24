/**
 * alarmService.ts - 闹铃音效播放服务
 *
 * 职责：
 * - 使用 expo-av 播放高音量闹铃音效
 * - 兼容所有安卓机型（包括 Xiaomi HyperOS，不依赖系统通知音）
 * - 支持循环播放和停止
 *
 * 使用场景：
 * - 系统通知到达时，作为额外闹铃触发
 * - 确保在国产 ROM（小米/红米/OPPO/vivo）上也能响铃
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// ============================================================
// 状态
// ============================================================

let currentAlarmSound: Audio.Sound | null = null;
let isAlarmPlaying = false;

// ============================================================
// 工具函数：生成基础频率音调
// ============================================================

/**
 * 生成简单的脉冲音调 WAV 数据
 * 频率 880Hz（标准闹铃音），脉冲模式 400ms 响 + 200ms 静音
 * 总长度约 8 秒
 *
 * 这个函数生成一个 WAV 文件的 base64 数据，可以在内存中播放
 */
function generateAlarmWavBase64(): string {
  const sampleRate = 44100;
  const duration = 8; // 8 秒
  const numSamples = sampleRate * duration;

  // WAV 头 + 数据
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV 文件头
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // 生成音频数据：脉冲波（880Hz 方波 + 静音交替）
  const freq1 = 880; // 基础频率
  const freq2 = 660; // 第二频率（交替变化更有闹铃感）

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const cycleTime = t % 0.6; // 0.6 秒周期

    let sample: number;

    if (cycleTime < 0.4) {
      // 响铃阶段：880Hz 或 660Hz 交替（每 2 秒切换频率）
      const freq = Math.floor(t / 2) % 2 === 0 ? freq1 : freq2;
      // 方波
      sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.9 : -0.9;
      // 渐入渐出包络（防止爆音）
      const envelope = Math.min(1, cycleTime / 0.02) * Math.min(1, (0.4 - cycleTime) / 0.02);
      sample *= envelope;
    } else {
      // 静音阶段
      sample = 0;
    }

    // 16-bit PCM
    const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  // 转为 base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================================
// 闹铃播放 API
// ============================================================

/**
 * 播放闹铃音效
 * 会先停止当前正在播放的闹铃
 * 使用 expo-av 播放内存中生成的 WAV 数据，不依赖系统通知音
 */
export async function playAlarmSound(): Promise<void> {
  try {
    // 先停止已有闹铃
    await stopAlarmSound();

    // 注意：不在此处修改 Audio.setAudioModeAsync
    // 录音需要 Audio 处于 recording 模式( allowsRecordingIOS: true )
    // 如果在播放闹铃时改变音频模式，会和后续的录音产生竞争条件
    // 导致语音识别失败（Issue #2 的根源）
    // expo-av 的 Sound 播放不需要特定音频模式

    // 生成闹铃 WAV 数据
    const base64 = generateAlarmWavBase64();
    const uri = `data:audio/wav;base64,${base64}`;

    // 创建并播放音效
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      {
        isLooping: true,                 // 循环播放直到手动停止
        volume: 1.0,                     // 最大音量
        shouldPlay: true,
        androidImplementation: 'MediaPlayer', // Android 使用 MediaPlayer 更稳定
      },
    );

    currentAlarmSound = sound;
    isAlarmPlaying = true;

    // 监听播放完成（循环模式下不会触发，仅用于错误处理）
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && !status.isPlaying && isAlarmPlaying) {
        // 如果意外停止，尝试恢复
        sound.playAsync().catch((e) => console.warn('[AlarmService] 恢复播放失败:', e));
      }
    });

    console.log('[AlarmService] 闹铃已开始播放');
  } catch (error) {
    console.error('[AlarmService] 播放闹铃失败:', error);
    isAlarmPlaying = false;
  }
}

/**
 * 停止闹铃音效
 */
export async function stopAlarmSound(): Promise<void> {
  try {
    if (currentAlarmSound) {
      await currentAlarmSound.stopAsync();
      await currentAlarmSound.unloadAsync();
      currentAlarmSound = null;
    }
    isAlarmPlaying = false;
    console.log('[AlarmService] 闹铃已停止');
  } catch (error) {
    console.error('[AlarmService] 停止闹铃失败:', error);
    currentAlarmSound = null;
    isAlarmPlaying = false;
  }
}

/**
 * 闹铃是否正在播放
 */
export function isAlarmCurrentlyPlaying(): boolean {
  return isAlarmPlaying;
}

/**
 * 自动停止闹铃（定时器版）
 * @param timeoutMs 超时毫秒数，默认 30 秒后自动停止
 */
export function scheduleAlarmStop(timeoutMs: number = 30000): void {
  setTimeout(() => {
    if (isAlarmPlaying) {
      stopAlarmSound();
    }
  }, timeoutMs);
}