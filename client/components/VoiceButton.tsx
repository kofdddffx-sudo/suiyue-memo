/**
 * VoiceButton.tsx - 巨大的"按住说话"录音按钮
 *
 * 适老化设计：
 * - 直径至少 120dp 的巨大圆形按钮
 * - 纯色背景 + 大号文字 + 清晰图标
 * - 按下时视觉/触觉反馈（颜色变化 + 震动）
 * - 松开自动停止录音并触发 AI 解析
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { FontAwesome6 } from '@expo/vector-icons';
import { PermissionService } from '@/services/PermissionService';
import { speakPleaseSpeak, speakRecordingStopped } from '@/services/speechService';

// ============================================================
// Props
// ============================================================

interface VoiceButtonProps {
  /** 录音完成后的回调，返回音频文件 URI */
  onRecordingComplete: (audioUri: string) => void;
  /** 是否正在 AI 解析中（禁用录音按钮） */
  isProcessing: boolean;
}

// ============================================================
// 组件
// ============================================================

export default function VoiceButton({ onRecordingComplete, isProcessing }: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  // ── 1. 进入页面时统一检查录音权限 ──
  useEffect(() => {
    (async () => {
      const granted = await PermissionService.request('MICROPHONE');
      setHasPermission(granted);
    })();
  }, []);

  // ── 脉冲动画（录音时红色呼吸效果） ──
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,        // 透明度降到 0.3
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // ── 按下缩放动画 ──
  const animatePress = (pressed: boolean) => {
    Animated.spring(scaleAnim, {
      toValue: pressed ? 0.9 : 1,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  // ============================================================
  // 录音逻辑
  // ============================================================

  /** 开始录音 */
  const startRecording = async () => {
    if (isProcessing) return;

    // 检查权限（统一走 PermissionService）
    if (!hasPermission) {
      const granted = await PermissionService.request('MICROPHONE');
      if (!granted) {
        PermissionService.showSettingGuide('MICROPHONE');
        return;
      }
      setHasPermission(true);
    }

    // 清理旧录音
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch { /* ignore */ }
      recordingRef.current = null;
    }

    try {
      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      // 创建新录音
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);

      // 触觉反馈（老人能感觉到按下）
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      // 语音引导
      speakPleaseSpeak();

      console.log('[VoiceButton] 录音开始');
    } catch (error) {
      console.error('录音启动失败:', error);
      Alert.alert('录音失败', '请确保已授予麦克风权限');
    }
  };

  /** 停止录音 */
  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      // 触觉反馈
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (uri) {
        console.log('[VoiceButton] 录音完成:', uri);
        // 语音确认
        speakRecordingStopped();
        // 将音频 URI 传给父组件处理
        onRecordingComplete(uri);
      }
    } catch (error) {
      console.error('停止录音失败:', error);
      setIsRecording(false);
    }
  };

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <View className="items-center justify-center py-6">
      {/* 脉冲背景圈 */}
      {isRecording && (
        <Animated.View
          className="absolute w-44 h-44 rounded-full bg-red-500/30"
          style={{ opacity: pulseAnim }}
        />
      )}

      {/* 录音主按钮 */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={isProcessing}
        onPressIn={() => {
          animatePress(true);
          startRecording();
        }}
        onPressOut={() => {
          animatePress(false);
          stopRecording();
        }}
        className={`
          w-36 h-36 rounded-full items-center justify-center
          ${isProcessing
            ? 'bg-gray-400'
            : isRecording
              ? 'bg-red-600'
              : 'bg-blue-600'
          }
          active:bg-blue-800
        `}
        style={{
          shadowColor: isRecording ? '#DC2626' : '#2563EB',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
        accessibilityLabel={isRecording ? '正在录音，松开停止' : '按住说话记事情'}
        accessibilityRole="button"
        accessibilityState={{ busy: isProcessing }}
      >
        <Animated.View
          style={{ transform: [{ scale: scaleAnim }] }}
          className="items-center justify-center"
        >
          {/* 麦克风图标用文字模拟，确保在所有设备上可见 */}
          <View className="items-center justify-center mb-1">
            {isRecording ? (
              <FontAwesome6 name="circle" size={48} color="#FF4444" solid />
            ) : (
              <FontAwesome6 name="microphone" size={48} color="#FFFFFF" solid />
            )}
          </View>
          <Text className="text-white text-2xl font-bold text-center leading-8">
            {isProcessing
              ? '解析中…'
              : isRecording
                ? '松开停止'
                : '按住说话\n记事情'
            }
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {/* 状态提示 */}
      <Text className="text-black text-xl mt-4 font-medium text-center">
        {isProcessing
          ? '正在理解您说的话…'
          : isRecording
            ? '正在录音，请说出您要记住的事情'
            : '按住按钮说出要提醒的事项'
        }
      </Text>
    </View>
  );
}