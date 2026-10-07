// 批次1/6 文字评审脚本：统计各资源文件文案字数，输出超限清单
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), 'utf8').replace(/\r/g, '');
const len = s => [...s.replace(/\{[a-zA-Z]+\}/g, '◆').trim()].length; // 占位符按1字计
const issues = [], ok = [];

function check(file, item, text, max, min = 0) {
  const n = len(text);
  (n > max || n < min ? issues : ok).push(`${file} | ${item} | ${n}字 ${n > max ? '超限>' : n < min ? '不足<' : 'OK'}${max}${min ? `~${max}` : ''} | ${text.slice(0, 20)}`);
}

// T02：每类表格行 `| 1 | 台词 |`，≤40
{
  let sec = '';
  for (const line of read('T02-导师教学对白.md').split('\n')) {
    const m = line.match(/^## (\d+\. [^（]+)/); if (m) sec = m[1];
    const r = line.match(/^\| \d \| (.+) \|$/); if (r) check('T02', sec, r[1], 40);
  }
}
// T03：同样结构，≤28
{
  let sec = '', char = '';
  for (const line of read('T03-书写指导与失败反馈.md').split('\n')) {
    const c = line.match(/^## (火|刀)$/); if (c) char = c[1];
    const m = line.match(/^### ([^（]+)/); if (m) sec = `${char}·${m[1]}`;
    const r = line.match(/^\| \d \| (.+) \|$/); if (r && sec) check('T03', sec, r[1], 28);
  }
}
// T01：标题≤8 正文≤45 按钮≤6（跳过表头与分隔行）
for (const line of read('T01-剧情节点文案.md').split('\n')) {
  const r = line.match(/^\| [0AB][^|]*\| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/);
  if (r) {
    const node = 'T01';
    check(node, `标题`, r[1], 8);
    check(node, `正文`, r[2], 45);
    if (!r[3].includes('/')) check(node, `按钮`, r[3], 6);
  }
}
// T04：背景短文≤20 玩法≤40 图鉴≤80 配方≤60
for (const line of read('T04-卡牌与材料文案.md').split('\n')) {
  const r = line.match(/^- (背景短文|玩法短描述|图鉴描述)（≤\d+字）：(.+)$/);
  if (r) check('T04', r[1], r[2], { '背景短文': 20, '玩法短描述': 40, '图鉴描述': 80 }[r[1]]);
  const f = line.match(/^- 说明：(.+)$/);
  if (f) check('T04', '配方说明', f[1], 60);
}
// T05：模板渲染后≤40（占位符计1字，偏宽松）
{
  let sec = '';
  for (const line of read('T05-战斗与结算文案.md').split('\n')) {
    const m = line.match(/^## \d\. ([^（]+)/); if (m) sec = m[1];
    const r = line.match(/^\| \d \| (.+) \|$/); if (r && sec) check('T05', sec, r[1], 40);
  }
}
// T06：每条 50~80
for (const line of read('T06-图鉴与文化短文.md').split('\n')) {
  const r = line.match(/^\d+\. \*\*([^*]+)\*\*：(.+)$/);
  if (r) check('T06', r[1], r[2], 80, 50);
}
// T07：朗读文本≤50（第5列）
for (const line of read('T07-语音台词文本.md').split('\n')) {
  const r = line.match(/^\| \d+ \| mentor \| [^|]+ \| [^|]+ \| ([^|]+) \|/);
  if (r) check('T07', '朗读文本', r[1], 50);
}

console.log(`共检查 ${issues.length + ok.length} 条，超限/不足 ${issues.length} 条：`);
for (const i of issues) console.log('  ✗ ' + i);
console.log(`通过 ${ok.length} 条。`);
