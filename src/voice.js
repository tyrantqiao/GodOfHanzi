const toggle = document.querySelector('#voice-enabled');
const volume = document.querySelector('#voice-volume');
const status = document.querySelector('#voice-status');
let context;
let source;
let gain;
let generation = 0;
let queue = Promise.resolve();
let enabled = toggle.checked;
let controller;
const recentLines = new Map();

function unlock() {
  context ||= new AudioContext();
  if (!gain) { gain = context.createGain(); gain.connect(context.destination); }
  gain.gain.value = Number(volume.value);
  void context.resume();
}

function unlockOnInteraction() {
  if (!enabled || context) return;
  unlock();
  status.textContent = '语音已开启';
}
document.addEventListener('click', unlockOnInteraction, { capture: true });
document.addEventListener('keydown', unlockOnInteraction, { capture: true });

export function stopVoice() {
  generation++;
  controller?.abort();
  source?.stop();
  source = null;
  queue = Promise.resolve();
}

export function speak(text, role = 'mentor', { interrupt = false, deduplicate = false } = {}) {
  if (!enabled || !context) return;
  if (deduplicate && Date.now() - (recentLines.get(text) || 0) < 60000) return;
  if (deduplicate) recentLines.set(text, Date.now());
  if (interrupt) stopVoice();
  const current = generation;
  queue = queue.then(async () => {
    if (current !== generation) return;
    controller = new AbortController();
    status.textContent = '语音准备中';
    const response = await fetch('/api/voice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, role }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]),
    });
    if (!response.ok) {
      if (response.status === 404) throw new Error('当前服务未启用语音，请重启游戏服务后刷新');
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || '语音暂不可用，字幕保留');
    }
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    if (current !== generation || !enabled) return;
    const playing = context.createBufferSource();
    playing.buffer = buffer;
    playing.connect(gain);
    source = playing;
    status.textContent = `${({ mentor: '陆青崖', hero: '沈砚', enemy: '霜藤妖' })[role]}正在说话`;
    await new Promise(resolve => { playing.onended = resolve; playing.start(); });
    if (current === generation) { source = null; status.textContent = '语音已开启'; }
  }).catch(error => {
    if (current === generation && error.name !== 'AbortError') {
      status.textContent = error.name === 'TimeoutError' ? '语音生成超时，请重试' : error.message || '语音暂不可用，字幕保留';
    }
  });
}

toggle.addEventListener('change', () => {
  enabled = toggle.checked;
  if (enabled) {
    unlock();
    speak('凝神落笔，字正则术成。', 'mentor', { interrupt: true });
  } else {
    stopVoice();
    status.textContent = '语音已关闭';
  }
});
volume.addEventListener('input', () => { if (gain) gain.gain.value = Number(volume.value); });
document.querySelector('#voice-preview').addEventListener('click', () => {
  enabled = true;
  toggle.checked = true;
  unlock();
  speak('师父，我准备好了。', 'hero', { interrupt: true });
  speak('好，先从一横开始。落笔要稳，空处留白。');
});
document.querySelector('#voice-stop').addEventListener('click', () => {
  stopVoice(); status.textContent = enabled ? '语音已开启' : '语音已关闭';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopVoice(); });
fetch('/api/voice/status').then(r => {
  if (r.status === 404) throw new Error('当前服务未启用语音，请重启游戏服务后刷新');
  if (!r.ok) throw new Error('语音服务未连接');
  return r.json();
}).then(data => {
  if (enabled && !context) status.textContent = data.ready ? '语音已开启' : data.message;
}).catch(error => { if (enabled && !context) status.textContent = error.message || '语音服务未连接'; });
