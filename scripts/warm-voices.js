import { createVoiceService } from '../voice-service.js';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

const service = createVoiceService(fileURLToPath(new URL('../', import.meta.url)));
try {
  for (let i = 0; i < 120 && !service.status().ready; i++) {
    if (service.status().message !== '语音模型正在加载') throw new Error(service.status().message);
    await setTimeout(500);
  }
  if (!service.status().ready) throw new Error('Voice model loading timed out');
  const lines = [
    ...['火', '刀', '止', '生'].flatMap(text => ['hero', 'mentor'].map(role => [text, role])),
    ['凝神落笔，字正则术成。', 'mentor'],
    ['师父，我准备好了。', 'hero'],
    ['先写火，点燃霜藤。再写刀，借火斩藤。', 'mentor'],
    ['顺着淡墨落笔。稳住笔锋。', 'mentor'],
    ['好字！这一笔成了。', 'mentor'],
    ['好字！笔势圆满。', 'mentor'],
    ['墨铺得太满。留些空白。', 'mentor'],
    ['笔画偏了。贴着淡墨再写。', 'mentor'],
    ['字已成形。再稳一点。', 'mentor'],
    ['笔力还浅。再贴近淡墨。', 'mentor'],
    ['调息回气。留心反击。', 'mentor'],
    ['字都不会写了吗', 'enemy'],
    ['走火入魔了吗', 'enemy'],
  ];
  for (const [text, role] of lines) {
    const started = performance.now();
    const wav = await service.generate(text, role);
    if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.length <= 44) throw new Error('Invalid WAV');
    console.log(JSON.stringify({ role, text, bytes: wav.length, milliseconds: Math.round(performance.now() - started) }));
  }
} finally { await service.close(); }
