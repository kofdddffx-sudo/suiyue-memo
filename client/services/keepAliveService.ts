/**
 * keepAliveService.ts - 后台保活服务
 *
 * 职责：
 * - 提供安卓前台服务（Foreground Service）机制
 * - 引导用户设置电池优化白名单、自启动等
 * - 使用 Intent 跳转到 vivo 系统设置页面
 *
 * vivo/iQOO 系统杀后台比较激进，需要：
 * 1. 开启"允许后台运行"
 * 2. 加入"电池优化白名单"
 * 3. 开启"自启动"
 * 4. 前台服务常驻通知
 */

import { Platform, Linking, Alert } from 'react-native';
import * as TaskManager from 'expo-task-manager';

// 后台任务名称
const BACKGROUND_TASK_NAME = 'memory-note-background-task';

// ============================================================
// 后台任务注册
// ============================================================

/**
 * 注册后台任务
 * 当系统有资源时会定期执行，用于检查待办提醒
 */
export function registerBackgroundTask() {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
    try {
      // 这里可以添加后台检查逻辑
      // 例如：检查是否有即将到期的任务
      console.log('[KeepAlive] 后台任务执行中...');
      return null as any;
    } catch (error) {
      console.error('[KeepAlive] 后台任务失败:', error);
    }
  });
}

// ============================================================
// 系统设置跳转
// ============================================================

/**
 * vivo 手机型号检测
 */
function isVivoDevice(): boolean {
  if (Platform.OS !== 'android') return false;
  const brand = Platform.constants?.Manufacturer?.toLowerCase() || '';
  return brand.includes('vivo') || brand.includes('bbk') || brand.includes('iqoo');
}

/**
 * 跳转到应用详情页（权限管理）
 * 用户可在此页面开启"自启动"、"通知"等权限
 */
export function openAppSettings() {
  if (Platform.OS !== 'android') {
    Alert.alert('提示', '该功能仅支持 Android 系统');
    return;
  }

  try {
    // 跳转到应用详情页
    Linking.openSettings();
  } catch (error) {
    console.error('无法打开设置:', error);
    Alert.alert('提示', '无法自动跳转，请手动打开：系统设置 → 应用管理 → 岁月备忘录');
  }
}

/**
 * 跳转到电池优化白名单页面
 * vivo/iQOO 的电池管理比较严格，
 * 需要将 App 加入白名单才能保证后台运行
 */
export function openBatteryOptimizationSettings() {
  if (Platform.OS !== 'android') {
    Alert.alert('提示', '该功能仅支持 Android 系统');
    return;
  }

  const openDefaultSettings = () => {
    try {
      // 跳转到电池优化设置
      Linking.openSettings();
      Alert.alert(
        '操作提示',
        '请在设置中搜索"电池优化"或"后台耗电管理"，\n' +
        '找到"岁月备忘录"并设置为"不优化"或"允许后台运行"。',
      );
    } catch {
      Alert.alert(
        '手动操作指引',
        '请按以下步骤操作：\n' +
        '1. 打开手机「设置」\n' +
        '2. 搜索「电池优化」\n' +
        '3. 找到「岁月备忘录」\n' +
        '4. 选择「不优化」',
      );
    }
  };

  if (isVivoDevice()) {
    // vivo 特殊处理：使用特定的 Intent Action
    try {
      // 很多 vivo 手机支持直接跳转到电池管理
      const vivoIntent = 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS';
      Linking.sendIntent(vivoIntent).catch(() => openDefaultSettings());
    } catch {
      openDefaultSettings();
    }
  } else {
    openDefaultSettings();
  }
}

/**
 * 跳转到自启动管理页面
 * vivo 的自启动权限控制非常严格
 */
export function openAutoStartSettings() {
  if (Platform.OS !== 'android') {
    Alert.alert('提示', '该功能仅支持 Android 系统');
    return;
  }

  if (isVivoDevice()) {
    Alert.alert(
      'vivo 自启动设置指引',
      '请按以下步骤操作：\n\n' +
      '1. 打开手机「设置」\n' +
      '2. 选择「应用与权限」\n' +
      '3. 选择「应用管理」\n' +
      '4. 找到「岁月备忘录」\n' +
      '5. 选择「耗电管理」\n' +
      '6. 开启「允许后台运行」\n' +
      '7. 开启「允许自启动」\n' +
      '8. 开启「允许关联启动」\n\n' +
      '请务必完成以上所有步骤，\n' +
      '否则 App 可能在后台被系统杀死，\n' +
      '导致无法按时提醒！',
    );
  } else {
    openAppSettings();
  }
}

// ============================================================
// 保活状态检查
// ============================================================

/**
 * 检查应用当前是否已获取必要的权限（提示性检查）
 * 注意：无法通过代码检测电池优化白名单等系统级权限，
 * 只能检查通知权限等可通过 API 获取的状态。
 */
export async function checkKeepAliveStatus(): Promise<string[]> {
  const issues: string[] = [];

  if (Platform.OS !== 'android') return issues;

  // 检查后台任务是否已注册
  const isRegistered = TaskManager.isTaskDefined(BACKGROUND_TASK_NAME);
  if (!isRegistered) {
    issues.push('后台任务未注册');
  }

  // 提示用户手动检查电池优化等系统级设置
  return issues;
}

/**
 * 获取保活优化建议列表
 */
export function getKeepAliveTips(): { icon: string; title: string; description: string; action: () => void }[] {
  return [
    {
      icon: 'bolt',
      title: '电池优化白名单',
      description: '将本应用加入电池优化白名单，防止系统休眠时杀死后台',
      action: openBatteryOptimizationSettings,
    },
    {
      icon: 'battery-full',
      title: '自启动与后台运行',
      description: '开启自启动和允许后台运行，确保提醒不被拦截',
      action: openAutoStartSettings,
    },
    {
      icon: 'bell',
      title: '通知权限检查',
      description: '确保通知权限已开启，否则手表无法同步提醒',
      action: openAppSettings,
    },
    {
      icon: 'clipboard-list',
      title: '应用详情设置',
      description: '跳转到系统设置中的应用管理页面，查看更多权限',
      action: openAppSettings,
    },
  ];
}