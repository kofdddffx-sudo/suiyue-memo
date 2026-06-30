# GitHub Actions 免费打包指南

## 前置条件
1. 拥有 GitHub 账号（没有请注册：https://github.com/signup）
2. 安装 Git（https://git-scm.com/downloads）

## 使用步骤

### 1. 创建 GitHub 仓库
访问 https://github.com/new 创建新仓库：
- 仓库名：`suiyuebeiwanglu`（或其他名称）
- 设为 **Private**（私有）
- **不要**勾选 "Add README" 等选项

### 2. 推送代码到 GitHub

在本地执行以下命令：

```bash
# 进入项目目录
cd /workspace/projects

# 初始化 Git（如果还没有）
git init

# 添加远程仓库（替换为你的 GitHub 用户名和仓库名）
git remote add origin https://github.com/你的用户名/suiyuebeiwanglu.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 3. 触发构建

#### 方式 A：手动触发（推荐）
1. 访问你的 GitHub 仓库页面
2. 点击顶部 **Actions** 标签
3. 左侧选择 **Build Android APK**
4. 点击 **Run workflow** 按钮
5. 选择 **main** 分支，点击 **Run workflow**

#### 方式 B：自动触发
修改 `.github/workflows/build-apk.yml` 文件，取消注释 `push` 触发器：
```yaml
on:
  workflow_dispatch:
  push:
    branches: [main]  # 取消这行的注释
```
之后每次推送代码到 main 分支都会自动构建。

### 4. 下载 APK

构建完成后（约 10-15 分钟）：
1. 在 Actions 页面点击对应的构建记录
2. 滚动到页面底部 **Artifacts** 部分
3. 点击 **suiyue-memo-apk** 下载 APK 文件

## 免费额度说明

GitHub Actions 免费额度：
- **公共仓库**：完全免费，无限构建
- **私有仓库**：每月 2,000 分钟（约可构建 100-200 次 APK）

## 注意事项

1. 构建的 APK 是 **未签名** 的，可以直接安装到手机上测试
2. 如果需要发布到应用商店，需要配置签名
3. 构建产物保留 30 天，过期后需要重新构建

## 常见问题

### Q: 构建失败怎么办？
A: 在 Actions 页面查看构建日志，根据错误信息修复代码后重新触发构建。

### Q: 如何查看构建进度？
A: 在 GitHub 仓库的 Actions 页面可以实时查看构建进度。

### Q: 构建需要多长时间？
A: 首次构建约 15-20 分钟，后续构建约 10-15 分钟。
