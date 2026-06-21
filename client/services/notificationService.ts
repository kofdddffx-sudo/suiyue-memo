/**
 * notificationService.ts - 本地通知服务
 *
 * 职责：
 * - 创建和调度本地通知（高优先级，支持手表同步）
 * - 通知栏快捷操作按钮：【已完成】和【不再提醒】
 * - 监听通知点击事件，处理任务状态变更
 *
 * 注意：vivo/iqoo 手表通过蓝牙同步手机系统通知栏，
 *    所以必须使用系统级本地通知（exp-notifications），
 *    并设置为高优先级以唤醒屏幕和手表震动。
 */

import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

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
 * - 设置通知点击事件监听
 * - 设置通知交互事件监听（Action Button 点击）
 *
 * 必须在使用其他功能前调用一次
 */
export function initNotifications() {
  // ── 配置通知栏 Action Buttons ──
  // 这两个按钮会直接显示在通知下拉栏中
  // 用户不用打开 App 即可操作
  Notifications.setNotificationCategoryAsync('task_actions', [
    {
      identifier: 'complete',        // Action 标识
      buttonTitle: '已完成',       // 按钮文字（大字清晰）
      options: {
        opensAppToForeground: false,  // 不打开 App 直接处理
        isAuthenticationRequired: false, // 不需要解锁
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

  // ── 创建 Android 高优先级通知通道 ──
  // 这是关键：只有高优先级的通道才能：
  // 1. 在 vivo 手表上同步显示
  // 2. 唤醒屏幕并震动
  // 3. 不被系统静默
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: NOTIFICATION_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.HIGH,        // 高优先级
      vibrationPattern: [0, 300, 100, 300],                    // 震动模式：震-停-震
      lightColor: '#2563EB',                                    // 指示灯蓝色
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // 锁屏显示
      bypassDnd: true,                                         // 绕过免打扰模式（重要！）
      enableVibrate: true,
    });

    // 创建前台服务通道
    Notifications.setNotificationChannelAsync(FOREGROUND_CHANNEL_ID, {
      name: FOREGROUND_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.LOW,         // 前台服务用低优先级
      sound: null,                                              // 前台服务通知不发声
    });
  }

  // ── 设置通知处理程序 ──
  // 当 App 在前台时收到通知，仍然显示通知栏横幅
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,           // iOS 横幅
      shouldShowList: true,             // 通知列表显示
    }),
  });
}

// ============================================================
// 获取权限
// ============================================================

/**
 * 请求通知权限
 * 返回是否已授权
 * 在 Android 13+ 上需要运行时权限
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
 * 创建并立即显示一个任务提醒通知
 * 携带 Action Button，用户可直接在通知栏操作
 *
 * @param taskId    任务 ID（用于回调处理）
 * @param title     通知标题（大字）
 * @param body      通知正文
 */
export async function showTaskNotification(
  taskId: string,
  title: string,
  body: string,
) {
  // 构造通知内容 - 使用类型断言兼容 Android 特有属性
  const content = {
    title,
    body,
    data: { taskId },
    categoryIdentifier: 'task_actions',
    sound: 'default',
    // 安卓特有属性通过类型断言添加
    ...(Platform.OS === 'android' && {
      channelId: NOTIFICATION_CHANNEL_ID,
      color: '#2563EB',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  } as Notifications.NotificationContentInput & Record<string, unknown>;

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: null, // null = 立即显示
  });
}

/**
 * 调度一个定时通知（用于未来提醒）
 * @param taskId  任务 ID
 * @param title   通知标题
 * @param body    通知正文
 * @param date    触发时间
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
    sound: 'default',
    ...(Platform.OS === 'android' && {
      channelId: NOTIFICATION_CHANNEL_ID,
      color: '#2563EB',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  } as Notifications.NotificationContentInput & Record<string, unknown>;

  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

// ============================================================
// 取消通知
// ============================================================

/**
 * 取消特定任务的所有待发通知
 */
export async function cancelTaskNotifications(taskId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter((n) => n.content.data?.taskId === taskId);

  for (const n of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
}

/**
 * 取消所有待发通知
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ============================================================
// 添加通知事件监听
// ============================================================

/**
 * 注册通知点击事件监听
 * 当用户点击通知或通知栏 Action Button 时触发
 *
 * @param onComplete   用户点击【✅ 已完成】时的回调
 * @param onDismiss    用户点击【❌ 不再提醒】时的回调
 * @returns 取消监听的函数
 */
export function addNotificationListeners(
  onComplete: (taskId: string) => void,
  onDismiss: (taskId: string) => void,
): () => void {
  // ── 监听交互事件（Action Button 点击） ──
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const { actionIdentifier, notification } = response;
    const taskId = notification.request.content.data?.taskId as string | undefined;
    if (!taskId) return;

    if (actionIdentifier === 'complete') {
      onComplete(taskId);
    } else if (actionIdentifier === 'dismiss') {
      onDismiss(taskId);
    }
    // actionIdentifier === 'expo.modules.notifications.actions.DEFAULT'
    // 表示用户点击了通知本身（非按钮），忽略
  });

  // ── 返回取消监听的清理函数 ──
  return () => {
    responseListener.remove();
  };
}

// ============================================================
// 前台服务通知
// ============================================================

/**
 * 显示前台服务常驻通知
 * 用于防止系统杀后台
 * 通知内容："岁月备忘录运行中"
 */
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

/**
 * 移除前台服务通知
 */
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