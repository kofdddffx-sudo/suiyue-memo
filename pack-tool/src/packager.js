/**
 * 项目打包器 - 将项目代码打包为可传输的压缩包
 * 自动排除 node_modules、.expo、.git 等非必要文件
 */
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const dayjs = require('dayjs');

class Packager {
  constructor(toolDir) {
    this.toolDir = toolDir;
  }

  /**
   * 打包项目为 .tar.gz 文件
   * @param {string} projectRoot - 项目根目录（如 ../client）
   * @param {string} outputDir - 输出目录
   * @param {string} projectName - 项目名称（用于文件名）
   * @returns {Promise<string>} 生成的压缩包路径
   */
  async packProject(projectRoot, outputDir, projectName) {
    const absRoot = path.resolve(this.toolDir, projectRoot);
    // 处理 Windows 绝对路径 (如 E:/xxx) 在 Linux 上的回退
    const isWindowsPath = /^[A-Za-z]:[/\\]/.test(outputDir);
    let absOutput;
    if (isWindowsPath) {
      // Linux 上无法写入 E:/，回退到本地 output 目录
      absOutput = path.join(this.toolDir, 'output', projectName);
      console.log(`  [*] 检测到 Windows 路径，回退到: ${absOutput}`);
    } else {
      absOutput = path.resolve(this.toolDir, outputDir);
    }

    // 确保输出目录存在
    await fs.ensureDir(absOutput);

    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const outputPath = path.join(absOutput, `${safeName}_${timestamp}.tar.gz`);

    console.log(`  [*] 正在打包项目: ${path.basename(absRoot)}`);
    console.log(`  [*] 输出文件: ${outputPath}`);

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('tar', { gzip: true });

      output.on('close', () => {
        const size = (archive.pointer() / 1024).toFixed(1);
        console.log(`  [+] 打包完成! 大小: ${size} KB`);
        resolve(outputPath);
      });

      archive.on('error', reject);

      archive.pipe(output);

      // 添加项目目录，排除不需要的文件
      archive.directory(absRoot, path.basename(absRoot), (entry) => {
        const name = entry.name || '';
        // 排除规则
        const excludes = [
          'node_modules', '.expo', '.git', '__pycache__',
          '.DS_Store', 'build-history',
          'android/.gradle', 'android/build', 'android/app/build',
          'ios/Pods', 'ios/build',
        ];
        // 通配排除
        const wildcardExcludes = ['.lock', '.log', '.tmp'];
        
        for (const pattern of excludes) {
          if (name.includes(pattern)) return false;
        }
        for (const pattern of wildcardExcludes) {
          if (name.endsWith(pattern)) return false;
        }
        
        return entry;
      });

      archive.finalize();
    });
  }

  /**
   * 导出项目为便携压缩包（不依赖 EAS）
   * @param {string} projectRoot - 项目根目录
   * @param {string} outputDir - 输出目录
   * @param {string} projectName - 项目名称
   */
  async exportSource(projectRoot, outputDir, projectName) {
    return this.packProject(projectRoot, outputDir, `${projectName}_源码`);
  }
}

module.exports = Packager;