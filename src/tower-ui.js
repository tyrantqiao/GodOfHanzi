// 轻量图标与提示层：不参与游戏结算，触屏操作不依赖悬浮。
const paths = {
  heart: 'M12 20 3 11C-1 4 7 1 12 7c5-6 13-3 9 4z',
  floor: 'M3 20h18M5 20v-5h5v-5h5V5h5v15',
  cards: 'M7 3h13v16H7zM4 6v15h13M10 8h7M10 12h7',
  brush: 'm8 15 9-12 4 3-10 11zM8 15c-5-1-2 6-6 6 7 2 11-1 9-4',
  sword: 'm4 20 4-4M5 13l6 6M8 15 18 3h3v3L10 17',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z',
  flame: 'M12 2c2 7 7 7 7 13a7 7 0 0 1-14 0c0-3 2-6 4-8 0 5 3 6 3-5z',
  energy: 'm13 2-9 12h7l-1 8 10-13h-7z',
  leaf: 'M4 20C-2 4 12 2 21 3c0 13-6 17-17 17zM4 20 16 8',
  chest: 'M3 10h18v10H3zM3 10V7l3-3h12l3 3v3M10 10v4h4v-4',
  remove: 'M5 5h14v14H5zM8 8l8 8M16 8l-8 8',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  question: 'M8 7a4 4 0 0 1 8 0c0 4-4 3-4 7M12 18v1',
  book: 'M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3zM12 6v15',
  menu: 'M4 6h16M4 12h16M4 18h16',
};
export function icon(key) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('ui-icon');
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[key] || paths.arrow); svg.append(path);
  return svg;
}
export function hint(node, title, copy) {
  node.dataset.hintTitle = title; node.dataset.hint = copy; node.removeAttribute('title');
}
export function actionFace(node, key, label, copy) {
  const content = document.createElement('span'), name = document.createElement('span');
  content.className = 'action-copy'; name.className = 'action-name'; name.textContent = label; content.append(name);
  if (copy) { const detail = document.createElement('small'); detail.textContent = copy; content.append(detail); }
  node.replaceChildren(icon(key), content); node.classList.add('action-option'); hint(node, label, copy || label);
}
export function stat(node, key, value, title, copy) {
  const number = document.createElement('span'); number.textContent = value; node.replaceChildren(icon(key), number);
  node.setAttribute('aria-label', `${title} ${value}`); hint(node, title, copy);
}
export function installHints() {
  const tooltip = document.createElement('div'); tooltip.id = 'ui-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true;
  document.body.append(tooltip);
  let active = null, timer = null, pointer = 'mouse', previousDescription = null;
  function hide() {
    clearTimeout(timer); tooltip.hidden = true;
    if (active) {
      if (previousDescription === null) active.removeAttribute('aria-describedby');
      else active.setAttribute('aria-describedby', previousDescription);
    }
    active = null;
  }
  function show(node) {
    hide(); if (!node?.isConnected || !node.dataset.hint) return;
    active = node; previousDescription = node.getAttribute('aria-describedby');
    node.setAttribute('aria-describedby', [previousDescription, tooltip.id].filter(Boolean).join(' '));
    const title = document.createElement('strong'), copy = document.createElement('p');
    title.textContent = node.dataset.hintTitle || node.getAttribute('aria-label') || '提示'; copy.textContent = node.dataset.hint;
    tooltip.replaceChildren(title, copy);
    // 原生 dialog 位于顶层；提示也放入同一弹窗，避免被遮住。
    (node.closest('dialog[open]') || document.body).append(tooltip); tooltip.hidden = false;
    const rect = node.getBoundingClientRect(), box = tooltip.getBoundingClientRect(), gap = 8;
    tooltip.style.left = `${Math.max(gap, Math.min(rect.left, innerWidth - box.width - gap))}px`;
    const top = rect.bottom + gap + box.height <= innerHeight ? rect.bottom + gap : rect.top - box.height - gap;
    tooltip.style.top = `${Math.max(gap, Math.min(top, innerHeight - box.height - gap))}px`;
  }
  document.addEventListener('pointerover', event => {
    pointer = event.pointerType;
    const node = event.target.closest('[data-hint]');
    if (pointer !== 'mouse' || !node || node.contains(event.relatedTarget)) return;
    clearTimeout(timer); timer = setTimeout(() => show(node), 180);
  });
  document.addEventListener('pointerout', event => {
    const node = event.target.closest('[data-hint]'); if (node && !node.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('pointerdown', event => { pointer = event.pointerType; hide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Tab') pointer = 'keyboard'; if (event.key === 'Escape') hide(); });
  document.addEventListener('focusin', event => { if (pointer === 'mouse' || pointer === 'keyboard') show(event.target.closest('[data-hint]')); });
  document.addEventListener('focusout', hide);
  document.addEventListener('click', hide, true);
  document.addEventListener('close', hide, true);
  document.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  return hide;
}
