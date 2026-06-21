/**
 * EAS Build 构建器 - 封装 Expo EAS Build 命令
 * 支持构建、状态查询、APK 下载
 */
const shell = require('shelljs');
const path = require('path');
const fs = require('fs-extra');
const dayjs = require('dayjs');

class EASBuilder {
  constructor(toolDir, configManager) {
    this.toolDir = toolDir;
    this.config = configManager;
  }

  /**
   * 执行 EAS Build
   * @param {string} projectId - 配置中的项目 ID
   * @returns {Promise<object>} 构建结果
   */
  async build(projectId) {
    const project = this.config.getProject(projectId);
    const defaults = this.config.getDefaults();
    const projectRoot = path.resolve(this.toolDir, project.root);

    console.log('');
    console.log('  ╔══════════════════════════════════════╗');
    console.log(`  ║  构建项目: ${project.name.padEnd(14, ' ')}║`);
    console.log(`  ║  包名: ${project.packageName.padEnd(20, ' ')}║`);
    console.log(`  ║  配置: ${project.easProfile.padEnd(22, ' ')}║`);
    console.log(`  ║  输出: ${project.outputDir.slice(0, 22).padEnd(22, ' ')}║`);
    console.log('  ╚══════════════════════════════════════╝');
    console.log('');

    // 检查项目目录
    if (!fs.existsSync(projectRoot)) {
      console.error(`  [!] 项目目录不存在: ${projectRoot}`);
      return { success: false, error: '项目目录不存在' };
    }

    // 检查 eas.json
    const easConfigPath = path.join(projectRoot, 'eas.json');
    if (!fs.existsSync(easConfigPath)) {
      console.error('  [!] 未找到 eas.json，请先配置 EAS Build');
      return { success: false, error: '缺少 eas.json' };
    }

    // 检查是否已登录 EAS
    const whoami = shell.exec('npx eas whoami', { cwd: projectRoot, silent: true });
    if (whoami.code !== 0 || !whoami.stdout.trim()) {
      console.error('  [!] 未登录 Expo 账号');
      console.log('  [?] 请执行: npx eas login');
      return { success: false, error: '未登录 Expo' };
    }
    console.log(`  [*] Expo 账号: ${whoami.stdout.trim()}`);

    // 确保输出目录存在
    const outputDir = project.outputDir;
    await fs.ensureDir(outputDir);

    // 执行 EAS Build
    console.log('  [*] 正在提交 EAS 云端构建...');
    console.log('  [*] 这可能需要 5-15 分钟，请耐心等待');
    console.log('');

    const buildCmd = `npx eas build --platform android --profile ${project.easProfile} --non-interactive --no-wait`;
    console.log(`  $ ${buildCmd}`);

    return new Promise((resolve) => {
      const result = shell.exec(buildCmd, {
        cwd: projectRoot,
        silent: false,
        async: true
      });

      result.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      result.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      result.on('close', (code) => {
        if (code === 0) {
          console.log('');
          console.log('  [+] EAS Build 已提交！');
          console.log('');
          console.log('  [?] 后续步骤:');
          console.log(`      1. 查看构建状态: npx eas build:list`);
          console.log(`      2. 构建完成后下载 APK`);
          console.log(`      3. 将 APK 放入: ${outputDir}`);
          resolve({ success: true });
        } else {
          console.error(`  [!] EAS Build 提交失败 (exit code: ${code})`);
          resolve({ success: false, error: 'EAS Build 提交失败' });
        }
      });
    });
  }

  /**
   * 查看构建历史
   */
  listBuilds() {
    console.log('');
    console.log('  [*] 查询 EAS 构建历史...');
    console.log('');
    shell.exec('npx eas build:list --platform android --limit 5', {
      cwd: path.resolve(this.toolDir, '../client'),
      silent: false
    });
  }
}

module.exports = EASBuilder;