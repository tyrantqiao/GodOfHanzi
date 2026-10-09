import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = mkdtempSync(path.join(tmpdir(), 'hanzi-update-tests-'));
const executable = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
function run(name, args) {
  const result = spawnSync(executable(name), args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} 退出码 ${result.status}`);
}
try {
  run('javac', ['-encoding', 'UTF-8', '-d', output, 'android/app/src/main/java/com/godofhanzi/game/UpdateDownload.java', 'android/tests/UpdateDownloadTest.java']);
  run('java', ['-cp', output, 'com.godofhanzi.game.UpdateDownloadTest']);
} finally { rmSync(output, { recursive: true, force: true }); }
