import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createVoiceService, normalizeSpeechText } from './voice-service.js';

test('teaching percentages are spoken as Chinese numbers', () => {
  assert.equal(normalizeSpeechText('「一」覆盖90%、准确100%、威力50%。'), '一覆盖百分之九十、准确百分之一百、威力百分之五十。');
  assert.equal(normalizeSpeechText('0% 10% 11% 9.5%'), '百分之零 百分之十 百分之十一 百分之九点五');
});

test('missing or partial models degrade gracefully and invalid requests are rejected', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'hanzi-voice-'));
  let service;
  try {
    const directory = path.join(root, 'models/kokoro-multi-lang-v1_1');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'model.onnx'), 'incomplete');
    service = createVoiceService(root);
    assert.equal(service.status().ready, false);
    for (const [text, role] of [['', 'hero'], ['字'.repeat(221), 'mentor'], ['一', 'unknown'], ['一', '__proto__']]) {
      await assert.rejects(service.generate(text, role), { status: 400 });
    }
    await assert.rejects(service.generate('一', 'hero'), { status: 503 });
  } finally {
    await service?.close();
    await rm(root, { recursive: true, force: true });
  }
});
