/**
 * 配置管理器 - 读取、写入、验证打包配置
 * 支持多项目配置管理，通过项目 ID 快速切换
 */
const fs = require('fs-extra');
const path = require('path');

const CONFIG_FILE = 'pack.config.json';
const TEMPLATE_FILE = path.join(__dirname, '..', 'templates', 'pack.config.template.json');

class ConfigManager {
  constructor(toolDir) {
    this.toolDir = toolDir;
    this.configPath = path.join(toolDir, CONFIG_FILE);
    this.config = null;
    this.projectId = null;
  }

  /** 读取配置文件 */
  load() {
    if (!fs.existsSync(this.configPath)) {
      console.error('  [!] 未找到配置: ' + this.configPath);
      console.log('  [?] 请先执行: pack init');
      process.exit(1);
    }
    this.config = fs.readJsonSync(this.configPath);
    return this.config;
  }

  /** 获取项目列表 */
  getProjects() {
    if (!this.config) this.load();
    return this.config.projects || {};
  }

  /** 列出所有项目 ID */
  listProjectIds() {
    return Object.keys(this.getProjects());
  }

  /** 获取指定项目的配置 */
  getProject(id) {
    const projects = this.getProjects();
    if (!projects[id]) {
      console.error(`  [!] 未找到项目配置: "${id}"`);
      console.log(`  [?] 可用项目: ${Object.keys(projects).join(', ')}`);
      process.exit(1);
    }
    this.projectId = id;
    return projects[id];
  }

  /** 获取默认配置 */
  getDefaults() {
    if (!this.config) this.load();
    return this.config.defaults || {};
  }

  /** 初始化新配置文件 */
  init() {
    if (fs.existsSync(this.configPath)) {
      console.log('  [*] 配置已存在: ' + this.configPath);
      return false;
    }
    fs.copySync(TEMPLATE_FILE, this.configPath);
    console.log('  [+] 已生成配置模板: ' + this.configPath);
    console.log('');
    console.log('  请编辑 pack.config.json，添加你的项目配置后执行:');
    console.log('    pack build <项目ID>');
    return true;
  }

  /** 添加新项目到配置 */
  addProject(id, config) {
    if (!this.config) this.load();
    this.config.projects[id] = {
      name: config.name || id,
      description: config.description || '',
      root: config.root || '../client',
      packageName: config.packageName || 'com.example.app',
      easProfile: config.easProfile || 'preview',
      outputDir: config.outputDir || './output'
    };
    fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
    console.log(`  [+] 已添加项目: "${id}"`);
  }
}

module.exports = ConfigManager;