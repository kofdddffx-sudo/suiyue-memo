/**
 * notificationService.ts - 本地通知服务（闹铃级）
 *
 * 职责：
 * - 创建和调度本地通知
 * - 通知使用系统默认音效（兼容所有安卓机型包括 Xiaomi HyperOS）
 * - 通知到达时触发 expo-av 闹铃播放（确保响铃）
 * - 通知栏快捷操作按钮：【已完成】和【不再提醒】
 *
 * ⚠️ 关键设计：
 * - 系统通知音效：使用 `sound: true`（系统默认），不依赖自定义 .wav
 * - 闹铃播放：通过 expo-av 的 alarmService 播放高音量脉冲音
 * - 双保险：系统通知 + 程序化音频播放
 */

import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { playAlarmSound, stopAlarmSound, scheduleAlarmStop } from './alarmService';

// ============================================================
// 通知配置
// ============================================================

/** 通知通道 ID（Android 需要） */
const NOTIFICATION_CHANNEL_ID = 'memory_note_reminders';
const NOTIFICATION_CHANNEL_NAME = '任务提醒';
const FOREGROUND_CHANNEL_ID = 'memory_note_foreground';
const FOREGROUND_CHANNEL_NAME = '后台服务';

// ============================================================
// 初始化
// ============================================================

/**
 * 初始化通知系统
 * - 配置通知处理行为
 * - 创建 Android 通知通道（高优先级）
 * - 设置通知到达监听（触发闹铃播放）
 * - 设置通知点击事件监听
 */
export function initNotifications() {
  // ── 配置通知栏 Action Buttons ──
  Notifications.setNotificationCategoryAsync('task_actions', [
    {
      identifier: 'complete',
      buttonTitle: '已完成',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false,
      },
    },
    {
      identifier: 'dismiss',
      buttonTitle: '不再提醒',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false,
      },
    },
  ]);

  // ── 创建 Android 通知通道 ──
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: NOTIFICATION_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.MAX,        // 最高优先级
      vibrationPattern: [0, 500, 200, 500, 200, 500],         // 急促震动
      lightColor: '#DC2626',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,                                         // 绕过免打扰
      enableVibrate: true,
      sound: 'default',                                        // 系统默认通知音（兼容所有机型）
    });

    // 前台服务通道（静音）
    Notifications.setNotificationChannelAsync(FOREGROUND_CHANNEL_ID, {
      name: FOREGROUND_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
    });
  }

  // ── 设置前台通知处理程序 ──
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // ── 注册通知到达监听器（触发闹铃播放） ──
  // 无论前台/后台，只要通知到达就尝试播放闹铃
  // 前台：expo-av 直接播放
  // 后台：系统通知音 + try expo-av（部分机型后台也可播放）
  Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data;
    const isTaskReminder = data?.taskId || notification.request.content.categoryIdentifier === 'task_actions';

    if (isTaskReminder) {
      console.log('[Notification] 任务通知到达，触发闹铃:', data?.taskId);
      // 播放闹铃音效（双保险：系统通知音 + expo-av 程序化播放）
      playAlarmSound();
      // 30 秒后自动停止闹铃
      scheduleAlarmStop(30000);
    }
  });
}

// ============================================================
// 获取权限
// ============================================================

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

// ============================================================
// 创建和调度通知
// ============================================================

/**
 * 立即显示任务创建确认通知（仅震动，不播放闹铃）
 * 闹铃只在定时提醒到达时播放
 */
export async function showTaskNotification(
  taskId: string,
  title: string,
  body: string,
) {
  const content = {
    title,
    body,
    data: { taskId },
    categoryIdentifier: 'task_actions',
    sound: 'default',                                          // 系统默认音效
    ...(Platform.OS === 'android' && {
      channelId: NOTIFICATION_CHANNEL_ID,
      color: '#DC2626',
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: true,
    }),
  } as Notifications.NotificationContentInput & Record<string, unknown>;

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });
}

/**
 * 调度定时任务通知
 */
export async function scheduleTaskNotification(
  taskId: string,
  title: string,
  body: string,
  date: Date,
) {
  const content = {
    title,
    body,
    categoryIdentifier: 'task_actions',
    data: { taskId },
    sound: 'default',                                          // 系统默认音效
    ...(Platform.OS === 'android' && {
      channelId: NOTIFICATION_CHANNEL_ID,
      color: '#DC2626',
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true,
      vibrate: true,
    }),
  } as Notifications.NotificationContentInput & Record<string, unknown>;

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });

  console.log('[Notification] 已调度通知:', title, date.toISOString());
}

// ============================================================
// 取消通知
// ============================================================

export async function cancelTaskNotifications(taskId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((n) => n.content.data?.taskId === taskId);

  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ============================================================
// 通知事件监听
// ============================================================

export function addNotificationListeners(
  onComplete: (taskId: string) => void,
  onDismiss: (taskId: string) => void,
): () => void {
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const { actionIdentifier, notification } = response;
    const taskId = notification.request.content.data?.taskId as string | undefined;
    if (!taskId) return;

    if (actionIdentifier === 'complete') {
      onComplete(taskId);
      // 用户点击"已完成" → 停止闹铃
      stopAlarmSound();
    } else if (actionIdentifier === 'dismiss') {
      onDismiss(taskId);
      // 用户点击"不再提醒" → 停止闹铃
      stopAlarmSound();
    }
  });

  return () => {
    responseListener.remove();
  };
}

// ============================================================
// 前台服务通知
// ============================================================

export async function showForegroundServiceNotification() {
  if (Platform.OS !== 'android') return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '岁月备忘录',
      body: '正在后台运行，确保按时提醒',
      sound: false,
    } as Notifications.NotificationContentInput,
    trigger: null,
  });
}

export async function hideForegroundServiceNotification() {
  if (Platform.OS !== 'android') return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const content = n.content as any;
    if (content.channelId === FOREGROUND_CHANNEL_ID) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}