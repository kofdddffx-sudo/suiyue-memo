/**
 * TaskCard.tsx - 任务卡片组件
 *
 * 适老化设计：
 * - 纯白背景 + 纯黑文字，超高对比度
 * - 复选框尺寸 32x32（远大于标准尺寸）
 * - 显示任务时间、重复标识
 * - 已完成任务用绿色 + 中划线
 * - 长按可删除（有二次确认）
 */

import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  Alert,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import type { Task, RepeatType } from '@/stores/TaskContext';

// ============================================================
// Props
// ============================================================

interface TaskCardProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

// ============================================================
// 工具函数
// ============================================================

/** 重复类型对应的中文标签 */
const repeatLabels: Record<RepeatType, string> = {
  none: '',
  daily: '每天',
  weekly: '每周',
  custom: '',
};

/** 获取日期的友好显示（今天/明天/后天/X月X日） */
const getDateLabel = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  const today = dayjs().startOf('day');
  const taskDate = dayjs(dateStr).startOf('day');
  const diff = taskDate.diff(today, 'day');
  if (diff === 0) return null; // 今天不显示日期标签
  if (diff === 1) return '明天';
  if (diff === 2) return '后天';
  if (diff > 2 && diff <= 7) return `${diff}天后`;
  return taskDate.format('M月D日');
};

/** 格式化时间显示（24小时制大号字体） */
function formatTime(time: string): string {
  return time; // 已经是 "HH:mm" 格式
}

// ============================================================
// 组件
// ============================================================

export default function TaskCard({ task, onToggleComplete, onDelete }: TaskCardProps) {
  const isCompleted = task.status === 'completed';

  /** 处理删除（二次确认） */
  const handleDelete = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Alert.alert(
      '删除提醒',
      `确定要删除「${task.title}」吗？\n删除后将不再提醒。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            onDelete(task.id);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onToggleComplete(task.id)}
      onLongPress={handleDelete}
      className={`
        flex-row items-center p-5 mb-3 rounded-xl
        border-2
        ${isCompleted
          ? 'bg-green-50 border-green-500'
          : 'bg-white border-gray-300'
        }
      `}
      accessibilityLabel={`${task.title}，${task.time}${isCompleted ? '，已完成' : ''}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isCompleted }}
    >
      {/* ── 超大复选框 ── */}
      <View
        className={`
          w-10 h-10 rounded-lg items-center justify-center mr-4
          border-2
          ${isCompleted
            ? 'bg-green-500 border-green-600'
            : 'bg-white border-gray-400'
          }
        `}
      >
        <Text className={`text-2xl ${isCompleted ? 'text-white' : 'text-transparent'}`}>
          ✓
        </Text>
      </View>

      {/* ── 任务内容 ── */}
      <View className="flex-1">
        {/* 标题 */}
        <Text
          className={`
            text-2xl font-bold leading-9
            ${isCompleted ? 'text-green-700 line-through' : 'text-black'}
          `}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        {/* 时间和日期/重复标识 */}
        <View className="flex-row items-center mt-2">
          <Text className="text-xl font-semibold text-blue-700">
            {formatTime(task.time)}
          </Text>
          {getDateLabel(task.date) && (
            <Text className={`text-lg ml-3 font-medium ${isCompleted ? 'text-green-600' : 'text-purple-600'}`}>
              {getDateLabel(task.date)}
            </Text>
          )}
          {task.repeat !== 'none' && (
            <Text className="text-lg text-orange-600 ml-3 font-medium">
              {repeatLabels[task.repeat]}
            </Text>
          )}
        </View>

        {/* ── 语音原文（语音识别出的原始文本） ── */}
        {task.description ? (
          <Text
            className={`
              text-base mt-2 leading-6
              ${isCompleted ? 'text-green-600' : 'text-gray-500'}
            `}
            numberOfLines={2}
          >
            {task.description}
          </Text>
        ) : null}

        {/* AI 置信度提示 */}
        {task.confidence < 0.6 && (
          <Text className="text-base text-amber-600 mt-1">
            如果识别不准确，可按住此卡片删除后重新录音
          </Text>
        )}
      </View>

      {/* ── 完成状态图标 ── */}
      {isCompleted && (
        <Text className="text-3xl ml-2 text-green-600 font-bold">OK</Text>
      )}
    </TouchableOpacity>
  );
}