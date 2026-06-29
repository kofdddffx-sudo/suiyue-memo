/**
 * home/index.tsx - 首页屏幕
 *
 * 适老化设计：
 * - 只有两个核心区域："语音记录区"和"今日任务列表"
 * - 顶部大字显示"岁月备忘录"和当前时间
 * - 巨大的录音按钮
 * - 任务卡片列表
 *
 * 核心流程：
 * 1. 用户按住录音按钮 → 录音
 * 2. 松开 → 调用后端 AI API 解析语音文本
 * 3. AI 返回解析结果（任务+时间）
 * 4. 自动创建本地任务 + 语音播报确认
 * 5. 显示在今日任务列表中
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';

import { Screen } from '@/components/Screen';
import VoiceButton from '@/components/VoiceButton';
import TaskCard from '@/components/TaskCard';
import { useTaskStore, type Task } from '@/stores/TaskContext';
import { speakTaskConfirmation, speakText } from '@/services/speechService';
import { initNotifications, scheduleTaskNotification, showForegroundServiceNotification, addNotificationListeners } from '@/services/notificationService';
import { PermissionService } from '@/services/PermissionService';
import { stopAlarmSound } from '@/services/alarmService';
import { useSafeRouter } from '@/hooks/useSafeRouter';

// ============================================================
// API 基础地址
// ============================================================

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL?.replace(/\/$/, '') || 'http://localhost:9091';

// ============================================================
// 首页
// ============================================================

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useSafeRouter();
  const taskStore = useTaskStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm'));
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);

  // 通知初始化（统一走 PermissionService）
  const notifInitRef = useRef(false);
  useEffect(() => {
    if (!notifInitRef.current) {
      notifInitRef.current = true;
      // 先初始化通知系统（需要较早在启动流程中执行）
      initNotifications();

      // 注册通知按钮点击监听（"已完成"或"不再提醒"时停止闹铃）
      const removeListener = addNotificationListeners(
        (taskId) => {
          console.log('[Home] 通知按钮：已完成', taskId);
          stopAlarmSound();
          taskStore.toggleComplete(taskId);
        },
        (taskId) => {
          console.log('[Home] 通知按钮：不再提醒', taskId);
          stopAlarmSound();
          taskStore.removeTask(taskId);
        },
      );

      // 然后异步请求权限和启动前台服务
      (async () => {
        const granted = await PermissionService.request('NOTIFICATIONS');
        if (granted) {
            try {
              await showForegroundServiceNotification();
            } catch (e) {
              console.warn('[Home] 前台服务通知启动失败:', e);
            }
          }
      })();

      // 组件卸载时清理监听器
      return () => removeListener();
    }
  }, []);

  // 时钟更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm'));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // ── 核心修复：当 Context 中的任务数据变化时，同步更新本地列表 ──
  // 显示所有任务（包括明天、后天、指定日期的任务）
  useEffect(() => {
    setTodayTasks(taskStore.state.tasks);
  }, [taskStore.state.tasks]);

  // 每次页面获得焦点时刷新任务列表（覆盖 useFocusEffect 确保初始加载）
  useFocusEffect(
    useCallback(() => {
      setTodayTasks(taskStore.state.tasks);
    }, [taskStore]),
  );

  // ============================================================
  // AI 任务解析
  // ============================================================

  /**
   * 将语音文本发送给后端 AI 接口解析
   * 后端会调用 LLM 并返回结构化的任务 JSON
   */
  const parseVoiceToTask = async (text: string): Promise<{
    task: string;
    time: string;
    date: string;
    repeat: string;
    confidence: number;
  } | null> => {
    try {
      console.log('[Home] 发送语音文本到 AI:', text);

      const response = await fetch(`${API_BASE}/api/v1/parse-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`API 响应异常: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Home] AI 解析结果:', JSON.stringify(data));

      return {
        task: data.task || text,
        time: data.time || dayjs().add(1, 'hour').format('HH:mm'),
        date: data.date || dayjs().format('YYYY-MM-DD'),
        repeat: data.repeat || 'none',
        confidence: data.confidence || 0.5,
      };
    } catch (error) {
      console.error('[Home] AI 解析失败:', error);
      return null;
    }
  };

  // ============================================================
  // 录音完成回调
  // ============================================================

  const handleRecordingComplete = async (audioUri: string) => {
    setIsProcessing(true);

    try {
      // ── 1. 将音频文件上传到后端进行语音识别 ──
      const formData = new FormData();
      const file = {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice.m4a',
      };
      formData.append('audio', file as any);

      const asrResponse = await fetch(`${API_BASE}/api/v1/speech-to-text`, {
        method: 'POST',
        body: formData,
      });

      let text = '';
      if (asrResponse.ok) {
        const asrData = await asrResponse.json();
        text = asrData.text || '';
        console.log('[Home] ASR 识别结果:', text);
      }

      // ── 2. 如果 ASR 成功，用 AI 解析文本 ──
      if (text) {
        const parsed = await parseVoiceToTask(text);

        if (parsed && parsed.task) {
          // ── 3. 创建本地任务 ──
          const taskDate = parsed.date || dayjs().format('YYYY-MM-DD');
          const newTask = await taskStore.addTask({
            title: parsed.task,
            time: parsed.time,
            date: taskDate,
            repeat: (parsed.repeat as any) || 'none',
            confidence: parsed.confidence,
            description: text,
            nextRemindDate: taskDate + 'T' + parsed.time + ':00',
          });

          // ── 4. 计算提醒时间并调度通知 ──
          const [hours, minutes] = parsed.time.split(':').map(Number);
          let triggerDate = dayjs(taskDate).hour(hours).minute(minutes).second(0).toDate();
          if (triggerDate <= new Date()) {
            // 如果解析出的日期是今天且时间已过，推迟到明天
            if (dayjs(taskDate).isSame(dayjs(), 'day')) {
              triggerDate = dayjs(triggerDate).add(1, 'day').toDate();
            }
          }
          try {
            await scheduleTaskNotification(
              newTask.id,
              `[提醒] ${parsed.task}`,
              `时间：${taskDate} ${parsed.time}`,
              triggerDate,
            );
            console.log('[Home] 通知已调度:', taskDate, parsed.time, triggerDate.toISOString());
          } catch (notifError) {
            console.error('[Home] 通知调度失败:', notifError);
          }

          // ── 5. 语音播报确认 ──
          speakTaskConfirmation(parsed.task, parsed.time, parsed.repeat, taskDate);

          // ── 6. 震动确认反馈（不发出声音） ──
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {} // 震动失败不影响主流程

          // ── 7. 刷新列表（同步由 useEffect 自动处理） ──
        } else {
          // AI 没解析出任务，用原文创建
          const fallbackTask = await taskStore.addTask({
            title: text,
            time: dayjs().add(1, 'hour').format('HH:mm'),
            repeat: 'none',
            confidence: 0.3,
            description: text,
            nextRemindDate: dayjs().add(1, 'hour').toISOString(),
          });

          // 调度提醒通知
          const fallbackDate = dayjs().add(1, 'hour').toDate();
          try {
            await scheduleTaskNotification(
              fallbackTask.id,
              `[提醒] ${text}`,
              `时间：${dayjs(fallbackDate).format('HH:mm')}`,
              fallbackDate,
            );
          } catch (notifError) {
            console.error('[Home] 后备通知调度失败:', notifError);
          }

          speakText(`已将「${text}」添加到提醒列表`);

          // 刷新列表（同步由 useEffect 自动处理）
        }
      } else {
        // ASR 失败，提示用户
        Alert.alert(
          '语音识别失败',
          '请确保网络连接正常，然后重试。\n您也可以长按录音按钮再次说话。',
        );
      }
    } catch (error) {
      console.error('[Home] 处理录音失败:', error);
      Alert.alert('处理失败', '抱歉，处理录音时出现错误，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================
  // 任务操作
  // ============================================================

  const handleToggleComplete = async (id: string) => {
    await taskStore.toggleComplete(id);
    // 不再手动 setTodayTasks（已由 useEffect 自动同步）
  };

  const handleDelete = async (id: string) => {
    await taskStore.removeTask(id);
    // 不再手动 setTodayTasks（已由 useEffect 自动同步）
  };

  // ============================================================
  // 渲染
  // ============================================================

  const todayStr = dayjs().format('YYYY-MM-DD');
  const pendingTasks = todayTasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => {
      // 按日期排序：今天 → 明天 → 后天 → 更远
      const dateA = a.date || todayStr;
      const dateB = b.date || todayStr;
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      // 同日期按时间排序
      return (a.time || '').localeCompare(b.time || '');
    });
  const completedTasks = todayTasks.filter((t) => t.status === 'completed');

  return (
    <Screen
      safeAreaEdges={['left', 'right', 'bottom']}
      statusBarStyle="dark"
    >
      {/* ── 顶部标题区 ── */}
      <View
        className="px-6 pt-2 pb-4 bg-white"
        style={{ paddingTop: insets.top + 8 }}
      >
        {/* 标题 */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-bold text-black leading-10">
              岁月备忘录
            </Text>
            <Text className="text-xl text-gray-600 mt-1 font-medium">
              {dayjs().format('M月D日 dddd')}
            </Text>
          </View>
          <Text className="text-5xl font-bold text-blue-700">
            {currentTime}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 语音记录区 ── */}
        <VoiceButton
          onRecordingComplete={handleRecordingComplete}
          isProcessing={isProcessing}
        />

        {/* ── AI 解析进度提示 ── */}
        {isProcessing && (
          <View className="flex-row items-center justify-center py-3 mb-2 bg-amber-50 rounded-xl border-2 border-amber-300">
            <ActivityIndicator size="small" color="#D97706" />
            <Text className="text-lg text-amber-700 ml-3 font-medium">
              AI 正在理解您的话...
            </Text>
          </View>
        )}

        {/* ── 分隔线 ── */}
        <View className="flex-row items-center my-4">
          <View className="flex-1 h-0.5 bg-gray-300" />
          <Text className="text-xl font-bold text-gray-600 mx-4">
            待办事项
          </Text>
          <View className="flex-1 h-0.5 bg-gray-300" />
        </View>

        {/* ── 待办任务列表 ── */}
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-xl text-gray-600 text-center leading-8">
              还没有待办事项{'\n'}按住下面的按钮，说出您要记住的事情
            </Text>
          </View>
        ) : (
          <>
            {/* 待办任务 */}
            {pendingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDelete}
              />
            ))}

            {/* 已完成任务（折叠显示） */}
            {completedTasks.length > 0 && (
              <>
                <Text className="text-lg text-green-700 font-medium mb-2 mt-2">
                  已完成 ({completedTasks.length})
                </Text>
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDelete}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* ── 底部留白（防止被任务卡片遮挡） ── */}
        <View className="h-8" />
      </ScrollView>

      {/* ── 底部设置入口 ── */}
      <View className="px-6 pb-4 pt-2 bg-white border-t-2 border-gray-200">
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          className="flex-row items-center justify-center py-3"
          accessibilityLabel="打开保活设置"
          accessibilityRole="button"
        >
          <Text className="text-lg text-blue-700 font-medium">
            后台保活设置（确保准时提醒）
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}