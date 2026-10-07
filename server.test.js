import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';
import { createAppServer, isBlocked } from './server.js';

test('isBlocked guards internal dirs, server source and traversal', () => {
  assert.equal(isBlocked('models/kokoro/model.onnx'), true);
  assert.equal(isBlocked('node_modules'), true);
  assert.equal(isBlocked('.git/config'), true);
  assert.equal(isBlocked('data/voice-cache/abc.wav'), true);
  assert.equal(isBlocked('server.js'), true);
  assert.equal(isBlocked('voice-service.js'), true);
  assert.equal(isBlocked('../outside.txt'), true);
  assert.equal(isBlocked(path.resolve('index.html')), true); // absolute escape
  assert.equal(isBlocked('index.html'), false);
  assert.equal(isBlocked('src/main.js'), false);
  assert.equal(isBlocked(path.join('data', 'save.local.json')), false);
});

let app;
let base;
let root;

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'hanzi-server-'));
  await mkdir(path.join(root, 'data'), { recursive: true });
  await mkdir(path.join(root, 'models/kokoro'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>proto</title>');
  await writeFile(path.join(root, 'models/kokoro/model.onnx'), 'secret-model');
  await writeFile(
    path.join(root, 'data/default-save.json'),
    JSON.stringify({ version: 2, battleState: { marker: 'default' } }),
  );

  app = createAppServer({ rootDir: root, port: 0 });
  app.server.listen(0);
  await once(app.server, 'listening');
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  app?.server.closeAllConnections?.();
  app.server.close();
  await once(app.server, 'close');
  await rm(root, { recursive: true, force: true });
});

test('GET / serves index.html', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /proto/);
});

test('blocked paths return 403 before touching the filesystem', async () => {
  assert.equal((await fetch(`${base}/server.js`)).status, 403);
  assert.equal((await fetch(`${base}/voice-service.js`)).status, 403);
  assert.equal((await fetch(`${base}/models/kokoro/model.onnx`)).status, 403);
});

test('missing files return 404', async () => {
  assert.equal((await fetch(`${base}/nope.txt`)).status, 404);
});

test('GET /api/save falls back to the default save', async () => {
  const res = await fetch(`${base}/api/save`);
  assert.equal(res.status, 200);
  const save = await res.json();
  assert.equal(save.battleState.marker, 'default');
});

test('POST then GET /api/save round-trips a player save with a timestamp', async () => {
  const post = await fetch(`${base}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 2, battleState: { marker: 'player' } }),
  });
  assert.equal(post.status, 200);
  const ack = await post.json();
  assert.equal(ack.ok, true);
  assert.ok(Date.parse(ack.savedAt));

  const written = JSON.parse(await readFile(path.join(root, 'data/save.local.json'), 'utf8'));
  assert.equal(written.battleState.marker, 'player');
  assert.equal(written.savedAt, ack.savedAt);

  const loaded = await (await fetch(`${base}/api/save`)).json();
  assert.equal(loaded.battleState.marker, 'player');
});

test('GET /api/voice/status degrades gracefully without models', async () => {
  const res = await fetch(`${base}/api/voice/status`);
  assert.equal(res.status, 200);
  const status = await res.json();
  assert.equal(status.ready, false);
  assert.equal(typeof status.message, 'string');
});
