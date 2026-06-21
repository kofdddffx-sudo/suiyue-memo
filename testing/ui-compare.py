"""
==========================================
  岁月备忘录 - UI 自动化截图对比工具
  用于对比不同版本间的 UI 变化
==========================================

用法: python ui-compare.py [截图目录]
"""

import os
import sys
import json
from datetime import datetime

REPORT_DIR = r"E:\其他\岁月APP\test-reports"

def scan_screenshots(directory):
    """扫描目录下的所有截图"""
    if not os.path.exists(directory):
        print(f"❌ 目录不存在: {directory}")
        return []
    
    screenshots = []
    for f in sorted(os.listdir(directory)):
        if f.endswith('.png'):
            full_path = os.path.join(directory, f)
            size = os.path.getsize(full_path)
            mtime = os.path.getmtime(full_path)
            screenshots.append({
                'name': f,
                'path': full_path,
                'size_kb': round(size / 1024, 1),
                'time': datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            })
    
    return screenshots

def generate_ui_report(screenshots, output_dir):
    """生成 UI 截图对比报告"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>岁月备忘录 - UI 截图记录</title>
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; background: #f5f5f5; padding: 20px; }
  h1 { font-size: 28px; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  .card { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .card img { width: 100%; border-radius: 8px; }
  .card .info { margin-top: 8px; font-size: 14px; color: #666; }
</style>
</head>
<body>
  <h1>📸 岁月备忘录 UI 截图记录</h1>
  <p>共 {} 张截图 | 生成时间: {}</p>
  <div class="gallery">
""".format(len(screenshots), datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    
    for s in screenshots:
        # 复制到报告目录
        import shutil
        dest = os.path.join(output_dir, s['name'])
        shutil.copy2(s['path'], dest)
        
        html += """
    <div class="card">
      <img src="{}" alt="{}" />
      <div class="info">
        <div>📁 {}</div>
        <div>📏 {:.1f} KB</div>
        <div>🕐 {}</div>
      </div>
    </div>
""".format(s['name'], s['name'], s['name'], s['size_kb'], s['time'])
    
    html += """
  </div>
</body>
</html>"""
    
    report_path = os.path.join(output_dir, 'ui-gallery.html')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"✅ UI 对比报告已生成: {report_path}")
    return report_path

def main():
    if len(sys.argv) > 1:
        scan_dir = sys.argv[1]
    else:
        scan_dir = REPORT_DIR
    
    screenshots = scan_screenshots(scan_dir)
    
    if not screenshots:
        print(f"⚠️  {scan_dir} 下没有找到截图")
        return
    
    print(f"📸 找到 {len(screenshots)} 张截图:")
    for s in screenshots:
        print(f"   {s['name']:30s} {s['size_kb']:>6.1f} KB  {s['time']}")
    
    report_path = generate_ui_report(screenshots, REPORT_DIR)

if __name__ == '__main__':
    main()