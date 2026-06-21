/**
 * settings/index.tsx - 设置页面（保活引导 + 权限管理）
 *
 * 适老化设计：
 * - 大字、高对比度
 * - 清晰的引导步骤
 * - 每个按钮有明确的文字说明
 * - 跳转系统设置前有确认弹窗
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/Screen';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import {
  openBatteryOptimizationSettings,
  openAutoStartSettings,
  openAppSettings,
  getKeepAliveTips,
  registerBackgroundTask,
} from '@/services/keepAliveService';
import { PermissionService } from '@/services/PermissionService';

// ============================================================
// 设置页面
// ============================================================

export default function SettingsScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const tips = getKeepAliveTips();

  // 注册后台任务
  React.useEffect(() => {
    registerBackgroundTask();
  }, []);

  /** 处理通知权限申请（统一走 PermissionService） */
  const handleNotificationPermission = async () => {
    const granted = await PermissionService.request('NOTIFICATIONS');
    if (granted) {
      alert('通知权限已开启，任务提醒将正常推送');
    }
  };

  return (
    <Screen
      safeAreaEdges={['left', 'right', 'bottom']}
      statusBarStyle="dark"
    >
      {/* ── 顶部标题 ── */}
      <View
        className="bg-blue-600 px-6 pb-6"
        style={{ paddingTop: insets.top + 8 }}
      >
        <View className="flex-row items-center mb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2"
            accessibilityLabel="返回首页"
            accessibilityRole="button"
          >
            <Text className="text-white text-3xl">←</Text>
          </TouchableOpacity>
          <Text className="text-white text-3xl font-bold">后台保活设置</Text>
        </View>
        <Text className="text-white/90 text-lg leading-7">
          完成以下设置，确保提醒准时推送到您的手表
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 保活优化卡片列表 ── */}
        {tips.map((tip, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.7}
            onPress={tip.action}
            className="bg-white rounded-xl p-5 mb-4 border-2 border-gray-300"
            accessibilityLabel={`${tip.title}：${tip.description}`}
            accessibilityRole="button"
          >
            <View className="flex-row items-center mb-2">
              <FontAwesome6 name={tip.icon} size={28} color="#2563EB" style={{ width: 40 }} />
              <Text className="text-2xl font-bold text-black flex-1 ml-3">
                {tip.title}
              </Text>
              <Text className="text-blue-600 text-xl">›</Text>
            </View>
            <Text className="text-lg text-gray-700 leading-7 ml-1">
              {tip.description}
            </Text>
          </TouchableOpacity>
        ))}

        {/* ── 通知权限检查 ── */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleNotificationPermission}
          className="bg-white rounded-xl p-5 mb-4 border-2 border-gray-300"
          accessibilityLabel="检查通知权限状态"
          accessibilityRole="button"
        >
          <View className="flex-row items-center mb-2">
            <FontAwesome6 name="bell" size={28} color="#2563EB" style={{ width: 40 }} />
            <Text className="text-2xl font-bold text-black flex-1 ml-3">
              检查通知权限
            </Text>
            <Text className="text-blue-600 text-xl">›</Text>
          </View>
          <Text className="text-lg text-gray-700 leading-7 ml-1">
            点击检查通知权限是否开启，若未开启可在此申请
          </Text>
        </TouchableOpacity>

        {/* ── 说明区域 ── */}
        <View className="bg-white rounded-xl p-5 mb-4 border-2 border-gray-300">
          <Text className="text-xl font-bold text-black mb-3">
            为什么需要这些设置？
          </Text>
          <View className="space-y-3">
            <Text className="text-lg text-gray-700 leading-7">
              1. 安卓系统（特别是vivo/iqoo）为了省电，会自动关闭不常用的应用
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              2. 如果 App 被关闭，提醒就无法推送，手表也不会震动
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              3. 将本应用加入电池优化白名单，系统就不会在后台关闭它
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              4. 手表通过蓝牙同步手机通知，所以手机通知权限必须开启
            </Text>
          </View>
        </View>

        {/* ── 使用说明 ── */}
        <View className="bg-white rounded-xl p-5 mb-4 border-2 border-gray-300">
          <Text className="text-xl font-bold text-black mb-3">
            使用说明
          </Text>
          <View className="space-y-3">
            <Text className="text-lg text-gray-700 leading-7">
              1. 在首页按住圆形按钮，说出您要记住的事情
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              2. AI 会自动分析语音，提取任务和时间
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              3. 您可以点击任务卡片切换完成状态
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              4. 长按任务卡片可删除不再需要的提醒
            </Text>
            <Text className="text-lg text-gray-700 leading-7">
              5. 到时间后，通知会推送到手机和手表
            </Text>
          </View>
        </View>

        {/* ── 版本信息 ── */}
        <Text className="text-center text-base text-gray-500 mt-4">
          岁月备忘录 v1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}