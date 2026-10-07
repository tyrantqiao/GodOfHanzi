"""在真实发布 APK 的安卓模拟器中验证离线启动、路线和本地存档。"""
import subprocess
import time
import xml.etree.ElementTree as ET
import re
from pathlib import Path

out = Path('smoke-evidence')
out.mkdir(exist_ok=True)

def adb(*args):
    return subprocess.check_output(['adb', *args]).decode('utf-8', errors='replace')

def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    raw = adb('shell', 'cat', '/sdcard/window.xml')
    (out / 'last-window.xml').write_text(raw, encoding='utf-8')
    return ET.fromstring(raw)

def find(label):
    for node in dump().iter('node'):
        if label in (node.get('text', '') + node.get('content-desc', '')):
            bounds = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
            if len(bounds) == 4 and bounds[2] > bounds[0] and bounds[3] > bounds[1]:
                return bounds
    return None

def wait(label, seconds=40):
    deadline = time.time() + seconds
    while time.time() < deadline:
        bounds = find(label)
        if bounds:
            return bounds
        time.sleep(1)
    raise AssertionError('未出现界面内容：' + label)

def click(label, direction='down'):
    for _ in range(12):
        bounds = find(label)
        if bounds:
            adb('shell', 'input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
            time.sleep(1)
            return
        coords = ('500', '1500', '500', '500') if direction == 'down' else ('500', '500', '500', '1500')
        adb('shell', 'input', 'swipe', *coords, '400')
        time.sleep(0.5)
    raise AssertionError('无法点击：' + label)

try:
    adb('install', '-r', 'smoke-apk/GodOfHanzi.apk')
    adb('shell', 'svc', 'wifi', 'disable')
    adb('shell', 'svc', 'data', 'disable')
    adb('shell', 'am', 'start', '-n', 'com.godofhanzi.game/.MainActivity')
    wait('收下卡组')
    click('收下卡组')
    click('奇遇 ·')
    wait('李白')
    click('保存', direction='up')
    adb('shell', 'am', 'force-stop', 'com.godofhanzi.game')
    adb('shell', 'am', 'start', '-n', 'com.godofhanzi.game/.MainActivity')
    wait('继续存档')
    click('继续存档', direction='up')
    click('李白')
    (out / 'result.txt').write_text('离线启动、进入首层奇遇、保存并重启恢复全部通过。', encoding='utf-8')
finally:
    subprocess.run(['adb', 'shell', 'screencap', '-p', '/sdcard/smoke.png'], check=False)
    subprocess.run(['adb', 'pull', '/sdcard/smoke.png', str(out / 'screen.png')], check=False)
    (out / 'logcat.txt').write_text(adb('logcat', '-d', '-t', '1000'), encoding='utf-8')
