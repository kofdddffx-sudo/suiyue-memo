import { ExpoConfig, ConfigContext } from 'expo/config';

const appName = '岁月备忘录';
const projectId = process.env.EXPO_PUBLIC_COZE_PROJECT_ID;
const slugAppName = projectId ? `app${projectId}` : 'suiyuebeiwanglu';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: appName,
    slug: slugAppName,
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "suiyuebeiwanglu",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ["audio", "remote-notification"]
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#1E3A5F"
      },
      package: `com.suiyuebeiwanglu.app`,
      permissions: [
        "RECORD_AUDIO",
        "POST_NOTIFICATIONS",
        "SCHEDULE_EXACT_ALARM",
        "USE_EXACT_ALARM",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_DATA_SYNC"
      ],
      blockedPermissions: [
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION"
      ]
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      [
        "expo-av",
        {
          microphonePermission: "岁月备忘录需要使用麦克风进行语音输入"
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#1E3A5F"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    }
  };
};