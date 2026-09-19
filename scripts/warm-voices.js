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
    ...['一', '刀', '人', '止'].flatMap(text => ['hero', 'mentor'].map(role => [text, role])),
    ['凝神落笔，字正则术成。', 'mentor'],
    ['师父，我准备好了。', 'hero'],
    ['好，先从一横开始。落笔要稳，空处留白。', 'mentor'],
    ['看淡墨底字落笔：覆盖该有的笔画，避开空白。覆盖与准确双过90%，便是完美。', 'mentor'],
    ['笔画偏得多了些。先追淡墨的骨架，覆盖上去，再谈速度。', 'mentor'],
    ['墨铺得太满，空白也被吞了。宁可少写一分，也别把画布涂成一团。', 'mentor'],
    ['已能成招。想要完美，就让覆盖和准确同时到90%以上。', 'mentor'],
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
