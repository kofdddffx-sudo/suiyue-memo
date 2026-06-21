# pack-tool - 通用 Expo 项目打包工具

## 简介

一键打包、导出、管理 APK 的通用工具。支持多项目配置，一个工具搞定所有 Expo 应用的构建流程。

## 快速开始

### 1. 将 pack-tool 放到你的项目旁

```
你的项目目录/
├── client/           # Expo 项目
├── server/           # 后端（如果有）
└── pack-tool/        # ← 放这里
    ├── pack.bat
    ├── src/
    └── ...
```

### 2. 初始化配置

```bash
cd pack-tool
npm install

# 初始化配置文件
node src/index.js init
```

### 3. 编辑配置

打开 `pack.config.json`，修改你的项目信息：

```json
{
  "projects": {
    "my-app": {
      "name": "你的应用名",
      "root": "../client",
      "packageName": "com.yourcompany.yourapp",
      "easProfile": "preview",
      "outputDir": "E:/你的输出目录"
    }
  }
}
```

### 4. 开始使用

**Windows**: 双击 `scripts/pack.bat`，按菜单操作

**命令行**:
```bash
# 打包
pack build my-app

# 导出源码
pack export my-app

# 查看 APK
pack apk my-app

# 查看历史
pack history my-app
```

## 命令说明

| 命令 | 说明 |
|------|------|
| `init` | 初始化打包配置 |
| `build <id>` | EAS Build 云端打包 |
| `export <id>` | 导出项目源码压缩包 |
| `apk <id>` | 查看/管理 APK |
| `history <id>` | 查看构建历史 |
| `list` | 列出所有项目 |
| `add <id>` | 交互式添加新项目 |

## 配置项说明

```json
{
  "projects": {
    "项目ID（唯一标识）": {
      "name": "显示名称",
      "description": "项目描述",
      "root": "项目目录（相对 pack-tool 的路径）",
      "packageName": "Android 包名",
      "easProfile": "EAS 构建配置 (preview/production)",
      "outputDir": "APK 输出目录"
    }
  },
  "defaults": {
    "androidSdk": "Android SDK 路径（留空自动检测）",
    "emulatorPath": "雷电模拟器路径",
    "buildHistoryDir": "构建历史存储目录"
  }
}
```

## 多项目示例

```json
{
  "projects": {
    "suiyue": {
      "name": "岁月备忘录",
      "root": "../client",
      "outputDir": "E:/其他/岁月APP"
    },
    "health": {
      "name": "健康助手",
      "root": "D:/projects/health-app/client",
      "outputDir": "D:/output/health"
    },
    "shop": {
      "name": "商城小程序",
      "root": "E:/workspace/shop-app/client",
      "outputDir": "E:/output/shop"
    }
  }
}
```