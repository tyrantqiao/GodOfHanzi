// 安卓更新状态由原生层持久化；网页负责进度与操作入口。
export function installUpdateControls() {
  const status = document.querySelector('#update-status');
  const check = document.querySelector('#check-update');
  const progress = document.querySelector('#update-progress');
  const details = document.querySelector('#update-details');
  const resume = document.querySelector('#resume-update');
  const pause = document.querySelector('#pause-update');
  const install = document.querySelector('#install-update');
  window.addEventListener('hanzi-update', ({ detail }) => {
    status.textContent = detail.message;
    check.disabled = Boolean(detail.busy);
    const downloading = detail.state === 'downloading';
    pause.hidden = !downloading; pause.disabled = !downloading;
    resume.hidden = !detail.available || ['ready', 'downloading', 'checking', 'verifying'].includes(detail.state);
    resume.disabled = Boolean(detail.busy);
    resume.textContent = detail.done > 0 ? '继续下载' : '下载新版';
    install.hidden = detail.state !== 'ready'; install.disabled = Boolean(detail.busy);
    const done = Number(detail.done) || 0, total = Number(detail.total);
    progress.hidden = !detail.available || detail.state === 'ready';
    if (total > 0) progress.value = Math.min(100, done * 100 / total);
    else progress.removeAttribute('value');
    const mb = bytes => (bytes / 1048576).toFixed(2) + ' MB';
    details.textContent = detail.available ? `新版 ${detail.versionName} · ${mb(done)}${total > 0 ? ' / ' + mb(total) + '（' + Math.floor(Math.min(100, done * 100 / total)) + '%）' : ''}` : '';
  });
  function invoke(method) {
    if (typeof window.HanziAndroid?.[method] !== 'function') {
      status.textContent = '当前为网页版本；检测与安装更新请在安卓安装版中使用。'; return;
    }
    try { window.HanziAndroid[method](); }
    catch { check.disabled = false; status.textContent = '无法启动更新操作，请稍后重试。'; }
  }
  check.onclick = () => invoke('checkUpdate');
  resume.onclick = () => invoke('resumeUpdate');
  pause.onclick = () => invoke('pauseUpdate');
  install.onclick = () => invoke('installUpdate');
}
