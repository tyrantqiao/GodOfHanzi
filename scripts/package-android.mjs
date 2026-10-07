import { cp, mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.join(root, 'android/app/src/main/assets');
await rm(target, { recursive: true, force: true });
await mkdir(path.join(target, 'data'), { recursive: true });
for (const page of ['index.html', 'tutorial.html', 'legacy.html']) await copyFile(path.join(root, page), path.join(target, page));
await cp(path.join(root, 'src'), path.join(target, 'src'), { recursive: true, filter: source => !source.endsWith('.test.js') });
for (const file of await readdir(path.join(root, 'data'))) {
  if (file.endsWith('.json') && !['save.local.json', 'default-save.json'].includes(file)) await copyFile(path.join(root, 'data', file), path.join(target, 'data', file));
}
console.log('安卓离线资源已生成。');
