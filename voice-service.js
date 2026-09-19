import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

export function normalizeSpeechText(text) {
  const digits = '零一二三四五六七八九';
  const number = value => {
    const n = Number(value);
    if (n === 100) return '一百';
    if (n < 10) return digits[n];
    if (n < 100) return `${n < 20 ? '' : digits[Math.floor(n / 10)]}十${n % 10 ? digits[n % 10] : ''}`;
    return [...value].map(d => digits[Number(d)]).join('');
  };
  return text.replace(/(\d+)(?:\.(\d+))?%/g, (_, whole, fraction) =>
    `百分之${number(whole)}${fraction ? `点${[...fraction].map(d => digits[Number(d)]).join('')}` : ''}`
  ).replace(/[「」]/g, '');
}

export function createVoiceService(root) {
  const modelDir = path.resolve(process.env.TTS_MODEL_DIR || path.join(root, 'models/kokoro-multi-lang-v1_1'));
  const cacheDir = path.join(root, 'data/voice-cache');
  const voices = { hero: { sid: 58, speed: 1 }, mentor: { sid: 65, speed: 0.95 }, enemy: { sid: 78, speed: 0.9 } };
  const pending = new Map();
  let worker;
  let ready = false;
  let error = '语音模型尚未安装';
  const required = ['model.onnx', 'voices.bin', 'tokens.txt', 'lexicon-us-en.txt', 'lexicon-zh.txt', 'espeak-ng-data'];
  if (required.every(name => existsSync(path.join(modelDir, name)))) {
    error = '语音模型正在加载';
    worker = new Worker(new URL('./voice-worker.js', import.meta.url), { workerData: { modelDir } });
    const fail = message => {
      ready = false;
      error = message;
      for (const job of pending.values()) job.reject(new Error(message));
      pending.clear();
    };
    worker.on('message', message => {
      if (message.ready) { ready = true; error = ''; return; }
      if (!message.id) { fail(message.error); return; }
      const job = pending.get(message.id);
      if (job) message.error ? job.reject(new Error(message.error)) : job.resolve();
    });
    worker.on('error', e => fail(e.message));
    worker.on('exit', () => fail('语音工作线程已停止'));
  }
  return {
    close: () => worker?.terminate(),
    status: () => ({ ready, message: error, engine: 'Kokoro Chinese / CPU' }),
    async generate(text, role) {
      if (typeof text !== 'string' || !text.trim() || text.length > 220 || !Object.hasOwn(voices, role)) {
        throw Object.assign(new Error('无效的台词或角色'), { status: 400 });
      }
      const voice = voices[role];
      text = normalizeSpeechText(text);
      const id = createHash('sha256').update(JSON.stringify(['kokoro-v1.1-zh-v1', text, voice])).digest('hex');
      const output = path.join(cacheDir, `${id}.wav`);
      if (existsSync(output)) return readFile(output);
      if (!ready) throw Object.assign(new Error(error), { status: 503 });
      if (pending.has(id)) { await pending.get(id).promise; return readFile(output); }
      if (pending.size >= 12) throw Object.assign(new Error('语音正在排队，请稍后重试'), { status: 429 });
      let resolve, reject;
      const generated = new Promise((yes, no) => { resolve = yes; reject = no; });
      const temporary = `${output}.tmp`;
      const promise = (async () => {
        await mkdir(cacheDir, { recursive: true });
        worker.postMessage({ id, text, ...voice, output: temporary });
        await generated;
        await rename(temporary, output);
      })().finally(() => { pending.delete(id); });
      pending.set(id, { promise, resolve, reject });
      try { await promise; } catch (e) { await unlink(temporary).catch(() => {}); throw e; }
      return readFile(output);
    },
  };
}
