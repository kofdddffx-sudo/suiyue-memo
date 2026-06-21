/**
 * PermissionService.ts - 统一权限管理中心
 *
 * 职责：
 * - 集中管理 App 需要用到的所有运行时权限
 * - 提供统一的检查、请求、状态追踪接口
 * - 统一的用户提示文案（大字 + 明确指引）
 * - 统一的错误处理和降级策略
 *
 * 权限清单（岁月备忘录）：
 * ├── MICROPHONE      → 语音输入（按住说话录音）
 * └── NOTIFICATIONS   → 任务提醒推送（含手表同步）
 *
 * 使用方式：
 *   import { PermissionService } from '@/services/PermissionService';
 *
 *   // 请求麦克风权限
 *   const granted = await PermissionService.request('MICROPHONE');
 *   if (!granted) {
 *     PermissionService.showSettingGuide('MICROPHONE');
 *   }
 */

import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Platform, Alert, Linking } from 'react-native';

// ============================================================
// 类型定义
// ============================================================

/** App 用到的权限类型枚举 */
export type PermissionType = 'MICROPHONE' | 'NOTIFICATIONS';

/** 权限状态 */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/** 权限配置项 */
interface PermissionConfig {
  /** 权限的中文名称（用于弹窗提示） */
  label: string;
  /** 权限用途说明（简洁一句话） */
  purpose: string;
  /** 拒绝后的引导提示 */
  guideMessage: string;
  /** 检查权限 */
  check: () => Promise<PermissionStatus>;
  /** 请求权限 */
  request: () => Promise<boolean>;
}

// ============================================================
// 权限配置表
// ============================================================

const PERMISSION_CONFIGS: Record<PermissionType, PermissionConfig> = {
  MICROPHONE: {
    label: '麦克风',
    purpose: '用于语音输入，按住说话录音',
    guideMessage:
      '岁月备忘录需要使用麦克风权限来录制您的语音备忘。\n\n' +
      '请前往：\n' +
      '手机设置 → 应用 → 岁月备忘录 → 权限 → 开启麦克风',
    check: async () => {
      const { status } = await Audio.getPermissionsAsync();
      if (status === 'granted') return 'granted';
      if (status === 'denied') return 'denied';
      return 'undetermined';
    },
    request: async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
      } catch {
        return false;
      }
    },
  },

  NOTIFICATIONS: {
    label: '通知',
    purpose: '用于任务提醒推送和手表同步',
    guideMessage:
      '岁月备忘录需要通过通知向您发送任务提醒，' +
      '并在您的 vivo/iqoo 手表上同步显示。\n\n' +
      '请前往：\n' +
      '手机设置 → 应用 → 岁月备忘录 → 通知 → 开启所有通知权限',
    check: async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') return 'granted';
      if (status === 'denied') return 'denied';
      return 'undetermined';
    },
    request: async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
      } catch {
        return false;
      }
    },
  },
};

// ============================================================
// 统一权限服务
// ============================================================

export const PermissionService = {
  /**
   * 检查权限状态
   * @param type 权限类型
   * @returns 'granted' | 'denied' | 'undetermined'
   */
  async check(type: PermissionType): Promise<PermissionStatus> {
    try {
      return await PERMISSION_CONFIGS[type].check();
    } catch (error) {
      console.warn(`[PermissionService] 检查 ${type} 权限失败:`, error);
      return 'denied';
    }
  },

  /**
   * 请求权限（含首次请求 + 二次请求处理）
   * - 首次拒绝 → 弹窗解释用途，让用户再次尝试
   * - 再次拒绝（已永久拒绝） → 提示去系统设置手动开启
   *
   * @param type 权限类型
   * @returns 是否已授权
   */
  async request(type: PermissionType): Promise<boolean> {
    const config = PERMISSION_CONFIGS[type];

    // 1. 先检查当前状态
    const status = await this.check(type);

    // 2. 已授权 → 直接返回
    if (status === 'granted') return true;

    // 3. 曾经拒绝过 → 友好弹窗解释用途
    if (status === 'denied') {
      const shouldRetry = await new Promise<boolean>((resolve) => {
        Alert.alert(
          `开启${config.label}权限`,
          config.purpose,
          [
            { text: '暂不开启', style: 'cancel', onPress: () => resolve(false) },
            { text: '去开启', onPress: () => resolve(true) },
          ],
          { cancelable: true }
        );
      });

      if (!shouldRetry) return false;

      // 尝试再次请求（Android 上会跳转系统权限设置页）
      const granted = await config.request();
      if (granted) return true;

      // 仍然拒绝 → 引导去系统设置
      await this.showSettingGuide(type);
      return false;
    }

    // 4. 从未请求过 → 直接请求
    const granted = await config.request();
    if (!granted) {
      await this.showSettingGuide(type);
    }
    return granted;
  },

  /**
   * 显示权限设置引导弹窗
   * 告诉用户如何手动开启权限
   *
   * @param type 权限类型
   */
  async showSettingGuide(type: PermissionType): Promise<void> {
    const config = PERMISSION_CONFIGS[type];

    Alert.alert(
      `需要${config.label}权限`,
      config.guideMessage,
      [
        { text: '我知道了', style: 'cancel' },
        {
          text: '去设置',
          onPress: () => {
            // 跳转到系统应用设置页
            if (Platform.OS === 'android') {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  },

  /**
   * 批量请求多个权限
   * 按顺序逐个请求，全部授权才返回 true
   *
   * @param types 权限类型列表
   * @returns 是否全部已授权
   */
  async requestMultiple(types: PermissionType[]): Promise<boolean> {
    for (const type of types) {
      const granted = await this.request(type);
      if (!granted) return false;
    }
    return true;
  },

  /**
   * 获取某个权限的中文名（用于展示）
   */
  getLabel(type: PermissionType): string {
    return PERMISSION_CONFIGS[type].label;
  },

  /**
   * 获取某个权限的用途说明（用于展示）
   */
  getPurpose(type: PermissionType): string {
    return PERMISSION_CONFIGS[type].purpose;
  },
};