/**
 * APK 管理器 - APK 文件验证、输出管理、版本追踪
 */
const fs = require('fs-extra');
const path = require('path');
const dayjs = require('dayjs');

class APKManager {
  constructor(toolDir, configManager) {
    this.toolDir = toolDir;
    this.config = configManager;
    this.buildHistoryDir = path.join(toolDir, 'build-history');
  }

  /** 统一路径解析 - 处理 Windows 路径回退 */
  _resolvePath(dirPath) {
    if (/^[A-Za-z]:[/\\]/.test(dirPath)) {
      // 在 Linux 上回退到本地目录
      const localDir = path.join(this.toolDir, 'output', path.basename(dirPath));
      if (!fs.existsSync(dirPath) && fs.existsSync(localDir)) {
        return localDir;
      }
      return localDir;
    }
    return path.resolve(this.toolDir, dirPath);
  }

  /**
   * 扫描输出目录中的 APK 文件
   * @param {string} outputDir - APK 输出目录
   * @returns {Array} APK 文件列表
   */
  scanAPKs(outputDir) {
    const absDir = this._resolvePath(outputDir);
    if (!fs.existsSync(absDir)) return [];

    const files = fs.readdirSync(absDir).filter(f => f.endsWith('.apk') || f.endsWith('.aab'));
    return files.map(f => {
      const stat = fs.statSync(path.join(absDir, f));
      return {
        name: f,
        path: path.join(absDir, f),
        size: (stat.size / 1024 / 1024).toFixed(1),
        modified: dayjs(stat.mtime).format('YYYY-MM-DD HH:mm:ss')
      };
    }).sort((a, b) => b.modified.localeCompare(a.modified));
  }

  /**
   * 从输出目录复制 APK 到指定位置
   * @param {string} sourceDir - APK 所在目录
   * @param {string} destPath - 目标路径（可以是目录或完整文件路径）
   * @param {string} appName - 应用名称
   * @returns {string} 复制后的路径
   */
  async copyAPK(sourceDir, destPath, appName) {
    const apks = this.scanAPKs(sourceDir);
    if (apks.length === 0) {
      console.error(`  [!] 未找到 APK 文件: ${sourceDir}`);
      return null;
    }

    const latest = apks[0];
    const destDir = this._resolvePath(destPath);
    await fs.ensureDir(destDir);

    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const safeName = appName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const destFile = path.join(destDir, `${safeName}_v${timestamp}.apk`);

    await fs.copy(latest.path, destFile);
    console.log(`  [+] APK 已复制到: ${destFile}`);
    console.log(`  [*] 大小: ${latest.size} MB | 最新修改: ${latest.modified}`);

    return destFile;
  }

  /**
   * 验证 APK 文件
   * @param {string} apkPath - APK 文件路径
   * @returns {object} 验证结果
   */
  validateAPK(apkPath) {
    if (!fs.existsSync(apkPath)) {
      return { valid: false, reason: '文件不存在' };
    }

    const stat = fs.statSync(apkPath);
    const sizeMB = stat.size / 1024 / 1024;

    // APK 基本验证
    const checks = {
      '文件存在': true,
      '大小合理 (5-200MB)': sizeMB >= 5 && sizeMB <= 200,
      '扩展名正确': apkPath.endsWith('.apk')
    };

    const allPass = Object.values(checks).every(v => v);
    return {
      valid: allPass,
      sizeMB: sizeMB.toFixed(1),
      modified: dayjs(stat.mtime).format('YYYY-MM-DD HH:mm:ss'),
      checks
    };
  }

  /**
   * 记录一次构建历史
   */
  async recordBuild(projectId, version, status) {
    const project = this.config.getProject(projectId);
    await fs.ensureDir(this.buildHistoryDir);

    const historyFile = path.join(this.buildHistoryDir, `${projectId}.json`);
    let history = [];

    if (fs.existsSync(historyFile)) {
      history = fs.readJsonSync(historyFile);
    }

    history.push({
      version,
      status,
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      project: project.name,
      packageName: project.packageName
    });

    // 只保留最近 20 条
    if (history.length > 20) {
      history = history.slice(-20);
    }

    fs.writeJsonSync(historyFile, history, { spaces: 2 });
  }

  /**
   * 查看构建历史
   */
  showHistory(projectId) {
    const historyFile = path.join(this.buildHistoryDir, `${projectId}.json`);
    if (!fs.existsSync(historyFile)) {
      console.log('  [*] 暂无构建历史');
      return [];
    }

    const history = fs.readJsonSync(historyFile);
    console.log('');
    console.log(`  ════════ 构建历史: ${projectId} ════════`);
    console.log('');

    history.slice().reverse().forEach((h, i) => {
      const statusMark = h.status === 'success' ? '+' : '-';
      console.log(`  [${statusMark}] ${h.timestamp} | ${h.version || '?'} | ${h.status}`);
    });

    return history;
  }
}

module.exports = APKManager;