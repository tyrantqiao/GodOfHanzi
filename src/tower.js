import { glyphStrokes, scoreCraft } from './tower-craft.js';
import { createRun, cardInfo, applyAction, restore, enemyIntent } from './tower-core.js';
import { availableCombos, missingIngredients } from './tower-combos.js';
import { loadServerSave, saveServer } from './storage.js';
const $ = s => document.querySelector(s);
let config, legacyConfig, previousConfig, run, actions = [], seed, restMode = 'rest';
const knownRecipes = new Set();
// 横屏单屏：次要面板复用原有内容与渲染入口。
for (const [selector, host] of [
  ['.reference-panel', 'collection-dialog'], ['#event-atlas', 'event-book-dialog'],
  ['#atlas', 'atlas-dialog'], ['#combo-panel', 'combo-dialog'],
  ['#relics', 'relic-dialog'], ['#boss-hint', 'relic-dialog'], ['#starter', 'starter-dialog']
]) $('#' + host).append($(selector));
for (const trigger of document.querySelectorAll('[data-panel]')) trigger.onclick = () => {
  const parent = trigger.closest('dialog'); if (parent) parent.close();
  $('#' + trigger.dataset.panel).showModal();
};
for (const close of document.querySelectorAll('[data-close]')) close.onclick = () => close.closest('dialog').close();
function inspectHandCard(id) {
  if (run.phase !== 'battle') return;
  const instance = run.deck.find(card => card.id === id), info = cardInfo(rules(), instance);
  const dialog = $('#card-dialog'); $('#card-detail').replaceChildren();
  cardButton(instance, $('#card-detail'), () => {}, true);
  $('#card-title').textContent = '「' + info.char + '」 · ' + info.name;
  $('#card-help').textContent = '消耗' + info.cost + '文气 · ' + text(info);
  $('#card-play').disabled = info.cost > run.combat.energy;
  $('#card-play').onclick = () => { dialog.close(); if (run.phase === 'battle' && run.combat.hand.includes(id)) requestPlay(id); };
  dialog.showModal();
}

function rememberRecipes(keys) {
  for (const key of keys) if (Object.hasOwn(config.recipes, key)) knownRecipes.add(key);
  try { localStorage.setItem('hanzi-tower-recipes-v2', JSON.stringify([...knownRecipes])); } catch {}
}
const names = { event: '奇遇 · 论诗 / 闯关 / 制卡', battle: '战斗 · 磨炼刀盾', elite: '精英 · 强化字卡', rest: '笔斋 · 回血 / 强化 / 删卡', treasure: '宝阁 · 遗物三选一', boss: '塔顶 · 首领试炼' };
const tagNames = { burn: '灼痕', guard: '守势', charge: '蓄势', cycle: '调序', spiral: '气旋' };
function rules() { return run?.rulesVersion === 1 ? legacyConfig : run?.rulesVersion === 2 ? previousConfig : config; }
function button(label, fn, parent) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; parent.append(b); return b; }
function text(card) {
  return [card.damage && (card.hits ? `${card.hits}次${card.damage}伤害` : `${card.damage}伤害`), card.block && `${card.block}格挡`, card.burn && `${card.burn}灼痕`,
    card.detonate && '引爆灼痕，每层+2伤害', card.weaken && `本回合敌方攻击-${card.weaken}`, card.draw && `抽${card.draw}张`,
    card.charge && `${card.charge}蓄势`, card.chargeDamage && `消耗全部蓄势，每点+${card.chargeDamage}伤害`, card.blockDamage && '伤害等于当前格挡',
    card.halveBlock && '随后消耗一半格挡（向上取整）', card.burningBlock && `敌人有灼痕时额外${card.burningBlock}格挡`,
    card.heavyBlock && `敌方意图≥12时额外${card.heavyBlock}格挡`, card.retainBlock && `下回合保留至多${card.retainBlock}剩余格挡`,
    card.burnDecay && '本战灼痕不再自然衰减（不可叠加）', card.scry && `看牌堆顶${card.scry}张，选1张置顶`,
    card.exchange && `弃至多${card.exchange}张其他手牌，抽弃牌数+1张`, card.retain && '保留', card.exhaust && '消耗'].filter(Boolean).join(' · ');
}
function art(src, alt = '') { const img = document.createElement('img'); img.src = src; img.alt = alt; return img; }
function cardButton(instance, parent, fn, preview = false) {
  const info = cardInfo(rules(), instance), face = config.cards[instance.key], b = button('', fn, parent); b.className = 'card'; b.dataset.type = face.type;
  const cost = document.createElement('span'); cost.className = 'card-cost'; cost.textContent = info.cost; cost.setAttribute('aria-label', `${info.cost}文气`);
  const picture = document.createElement('span'); picture.className = 'card-art'; picture.append(art(face.art));
  const glyph = document.createElement('span'); glyph.className = 'glyph'; glyph.textContent = info.char; picture.append(glyph);
  if (instance.ink) { glyph.hidden = true; const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 100 100'); svg.classList.add('personal-ink'); for(const stroke of instance.ink){const path=document.createElementNS(svg.namespaceURI,'polyline');path.setAttribute('points',stroke.map(p=>p.join(',')).join(' '));svg.append(path);} picture.append(svg); }
  const title = document.createElement('strong'); title.textContent = info.name + (instance.upgraded ? ' +' : '');
  const type = document.createElement('span'); type.className = 'card-type'; type.textContent = config.cardTypes[face.type].name + (info.flameTier ? ` · ${info.flameTier === 1 ? '初焰' : '盛焰'}` : '');
  const copy = document.createElement('small'); copy.textContent = text(info) + (instance.ink ? ' · 亲笔' : '');
  const tags = document.createElement('span'); tags.className = 'card-tags'; tags.textContent = (face.tags || []).map(tag => tagNames[tag]).join(' / ');
  b.append(cost, picture, title, type, copy, tags);
  b.title = `${info.char} · ${info.name}：${info.cost}文气，${text(info)}`;
  if (preview) { b.disabled = true; b.classList.add('preview'); }
  return b;
}
function pulse(src, label) {
  const host = $('#effect'); host.replaceChildren();
  const visual = document.createElement('div'); visual.className = 'cast-effect'; visual.append(art(src));
  const name = document.createElement('strong'); name.textContent = label; visual.append(name); host.append(visual);
}
function act(type, arg = null) {
  if (!run) return;
  const skill = type === 'release' && run.combat?.skill ? config.recipes[run.combat.skill.key] : null;
  const firstDiscovery = type === 'fuse' && !knownRecipes.has(arg.key);
  if (applyAction(run, rules(), [type, arg], legacyConfig, previousConfig)) {
    actions.push([type, arg]); restMode = 'rest'; render();
    if (skill) pulse(skill.art, skill.name);
    if (type === 'fuse') { const recipe = config.recipes[arg.key]; rememberRecipes([arg.key]); renderBook(); pulse(recipe.art, `${firstDiscovery ? '初悟' : '凝成'} · ${recipe.name}`); }
  }
}
function recipeFormula(recipe) { return [recipe.from && config.recipes[recipe.from].name, ...recipe.materials.map(key => config.cards[key].char)].filter(Boolean).join(' ＋ '); }
function renderCombos() {
  const panel = $('#combo-panel'); panel.hidden = run.phase !== 'battle' || run.rulesVersion === 1;
  $('#marks').replaceChildren(); $('#combos').replaceChildren(); $('#skill-slot').replaceChildren();
  if (panel.hidden) return;
  const c = run.combat;
  $('#combo-help').textContent = `凝式 ${c.fusions}/${config.limits.fusions} · 释放 ${c.releases}/${config.limits.releases} · 字印本回合有效；第4枚替换最早字印。`;
  for (const mark of c.marks) { const span = document.createElement('span'); span.className = 'mark'; span.textContent = config.cards[mark.key].char; $('#marks').append(span); }
  if (!c.marks.length) $('#marks').textContent = '打出字卡，留下字印。';
  const available = availableCombos(run, config);
  for (const combo of available) {
    const recipe = config.recipes[combo.key];
    const b = button(`${combo.replacing ? '替换' : recipe.from ? '进阶' : '凝式'} · ${recipeFormula(recipe)} → ${recipe.name}`, () => {
      if (combo.replacing && !confirm(`散去当前术式，改凝「${recipe.name}」？`)) return;
      act('fuse', {key: combo.key, markIds: combo.markIds, replace: combo.replacing});
    }, $('#combos'));
    b.title = `${recipe.description} · 释放${recipe.cost}文气`;
  }
  if (!available.length) {
    const hints = Object.values(config.recipes).filter(recipe => !recipe.from && recipe.materials.some(key => c.marks.some(m => m.key === key))).slice(0, 2);
    $('#combos').textContent = c.fusions >= config.limits.fusions ? '本回合凝式次数已用尽。' : hints.length ? `可尝试：${hints.map(recipe => recipeFormula(recipe)).join('；')}` : '火＋山、山＋止、气＋旋，皆可成式。';
  }
  if (c.skill) {
    const recipe = config.recipes[c.skill.key];
    $('#skill-slot').append(art(recipe.art));
    const title = document.createElement('h3'); title.textContent = recipe.name;
    const desc = document.createElement('p'); desc.textContent = `${recipe.description} 第${c.skill.expires}回合结束消散${c.skill.expires === c.round ? ' · 本回合到期！' : '。'}`;
    $('#skill-slot').append(title, desc);
    const release = button(`释放 · ${recipe.cost}文气`, () => act('release'), $('#skill-slot')); release.disabled = recipe.cost > c.energy || c.releases >= config.limits.releases;
    button('散去术式', () => act('abandon'), $('#skill-slot'));
    const paths = Object.values(config.recipes).filter(r => r.from === c.skill.key);
    if (paths.length) { const hint = document.createElement('small'); hint.textContent = '进阶：' + paths.map(r => `${recipeFormula(r)} → ${r.name}`).join('；'); $('#skill-slot').append(hint); }
  } else $('#skill-slot').textContent = '术式槽 · 空\n凝成后可立即释放，也可保留到下一回合再接字进阶。';
}
function requestPlay(id) {
  const instance = run.deck.find(c => c.id === id), info = cardInfo(rules(), instance);
  if (run.rulesVersion === 1 || (!info.scry && !info.exchange)) { act('play', id); return; }
  const ids = info.scry ? run.combat.draw.slice(0, info.scry) : run.combat.hand.filter(other => other !== id);
  if (info.scry && !ids.length) { act('play', {id, targets: []}); return; }
  const selected = new Set(), picker = $('#picker'); $('#picker-cards').replaceChildren();
  $('#picker-title').textContent = `「${info.char}」 · 选择字卡`;
  $('#picker-help').textContent = info.scry ? '选择1张置顶；确认前不消耗文气。' : `选择至多${info.exchange}张弃置，也可不选。确认后抽选择数量+1张。`;
  const confirmButton = $('#picker-confirm'); confirmButton.disabled = Boolean(info.scry);
  for (const other of ids) {
    const b = cardButton(run.deck.find(c => c.id === other), $('#picker-cards'), () => {
      if (selected.has(other)) selected.delete(other);
      else if (info.scry) { selected.clear(); selected.add(other); }
      else if (selected.size < info.exchange) selected.add(other);
      for (const item of $('#picker-cards').children) item.setAttribute('aria-pressed', String(selected.has(Number(item.dataset.cardId))));
      confirmButton.disabled = Boolean(info.scry && selected.size !== 1);
    }); b.dataset.cardId = other; b.setAttribute('aria-pressed', 'false');
  }
  confirmButton.onclick = () => { picker.close(); act('play', {id, targets: [...selected]}); };
  picker.showModal();
}
$('#picker-cancel').onclick = () => $('#picker').close();
function renderRest() {
  $('#log').textContent = '笔斋：回血、强化或删卡，只能选择一次。亲笔制卡机会在奇遇中获得。';
  const tabs = document.createElement('div'); tabs.className = 'rest-tabs'; $('#choices').append(tabs);
  button(`休息 · 回复${config.restHeal}生命`, () => act('rest'), tabs);
  for (const [mode, label] of [['upgrade', '强化字卡'], ['remove', '删去字卡'], ...(run.rulesVersion === 2 ? [['craft','临摹补卡（旧版）']] : [])]) {
    const b = button(label, () => { restMode = mode; render(); }, tabs); b.setAttribute('aria-pressed', String(restMode === mode));
  }
  const cards = document.createElement('div'); cards.className = 'rest-cards'; $('#choices').append(cards);
  if (restMode === 'upgrade') for (const instance of run.deck.filter(c => !c.upgraded)) cardButton({...instance, upgraded: true}, cards, () => act('rest', instance.id));
  if (restMode === 'remove') {
    if (run.deck.length <= config.limits.minimumDeck) cards.textContent = `牌组至少保留${config.limits.minimumDeck}张，可选择其他行动。`;
    else for (const instance of run.deck) cardButton(instance, cards, () => { if (confirm(`删去「${config.cards[instance.key].char}」并消耗本次笔斋行动？`)) act('remove', instance.id); });
  }
  if (restMode === 'craft') for (const key of run.craftChoices) cardButton({key}, cards, () => act('craft', key));
  if (restMode === 'rest') cards.textContent = '生命充足时可强化或删牌。想要新字卡，请前往奇遇。';
}
function render() {
  document.body.dataset.phase = run.phase; $('#combo-open').hidden = run.phase !== 'battle' || run.rulesVersion === 1; if (run.phase !== 'battle' && $('#combo-dialog').open) $('#combo-dialog').close();
  $('#title').textContent = `第${run.floor} / ${config.floors}层 · ${run.phase === 'won' ? '登顶' : run.phase === 'lost' ? '试炼结束' : '登塔修行'}`;
  $('#meta').textContent = `生命 ${run.hp}/${run.maxHp} · 牌册 ${run.deck.length}张${run.rulesVersion === 1 ? ' · 旧版试炼' : ''}`;
  $('#log').textContent = run.log; $('#log').hidden = run.phase.startsWith('event'); $('#choices').replaceChildren(); $('#hand').replaceChildren(); $('#deck').replaceChildren(); $('#relics').replaceChildren();
  const battling = run.phase === 'battle'; $('.enemy').hidden = !battling; $('#enemy-status').hidden = !battling; $('#end').hidden = !battling; $('#piles').textContent = '';
  $('#boss-hint').textContent = run.boss ? `本局塔顶：${run.boss.name} · ${run.boss.attacks.map(n => n ? `攻击${n}` : '蓄力').join(' → ')}${run.boss.armors ? ' · 部分回合有护甲' : ''}` : '';
  for (const key of run.relics || []) {
    const relic = config.relics[key], item = document.createElement('span'); item.className = 'relic-chip'; item.title = relic.description;
    item.append(art(relic.art)); const name = document.createElement('span'); name.textContent = `${relic.name} · ${relic.description}`; item.append(name); $('#relics').append(item);
  }
  if (run.phase === 'route') { $('#log').textContent = run.rulesVersion < 3 ? '旧版试炼按原卡组与路线继续；新一局进入刀盾奇遇玩法。' : '从刀盾起步，前往奇遇获取新字卡。答题、冒险与亲笔制卡，逐步补齐构筑。'; for (const route of run.routes) button(names[route], () => act('route', route), $('#choices')); }
  if (battling) {
    const c = run.combat, intent = enemyIntent(run);
    $('.enemy').src = c.enemy.art || 'src/assets/characters/frost-vine.png'; $('.enemy').alt = c.enemy.name;
    $('#enemy-status').textContent = `${c.elite ? '精英 · ' : ''}${c.enemy.name} ｜ 生命${c.enemyHp}/${c.enemy.hp}\n意图：${intent.base ? `攻击${intent.attack}` : '蓄力 · 本轮不攻击'} ｜ 护甲${intent.armor} ｜ 灼痕${c.burn}`;
    $('#piles').textContent = `第${c.round}回合 · 文气${c.energy}/${config.energy} · 格挡${c.block} · 蓄势${c.charge || 0}\n抽牌${c.draw.length} · 弃牌${c.discard.length} · 消耗${c.exhaust?.length || 0}`;
    for (const id of c.hand) {
      const instance = run.deck.find(x => x.id === id), b = cardButton(instance, $('#hand'), () => inspectHandCard(id)); b.disabled = cardInfo(rules(), instance).cost > c.energy;
      if (run.rulesVersion >= 2 && !c.stamped.includes(id)) {
        const mark = {id:c.nextMark, cardId:id, key:instance.key, flameTier:config.cards[instance.key].flameTier || 0};
        const projected = {...run, combat:{...c, marks:[...c.marks,mark].slice(-config.limits.marks)}};
        if (availableCombos(projected, config).some(option => option.markIds.includes(mark.id))) b.classList.add('combo-ready');
      }
      if (!c.stamped?.includes(id) && c.marks?.length === config.limits.marks) b.title += `；留印将替换最早「${config.cards[c.marks[0].key].char}」印。`;
    }
  }
  if (run.phase === 'reward') {
    for (const key of run.rewards) {
      const b = cardButton({key, upgraded:run.rulesVersion < 3 && run.combat.elite}, $('#choices'), () => act('reward', key));
      const hint = document.createElement('span'); hint.className = 'reward-hint';
      const links = Object.keys(config.recipes).filter(recipeKey => { const missing = missingIngredients(config, run.deck, recipeKey); return missing.length === 1 && missing[0] === key; }).slice(0, 2);
      hint.textContent = links.length ? `可补齐：${links.map(k => config.recipes[k].name).join(' / ')}` : `入册后${run.deck.length + 1}张`; b.append(hint);
    }
    button('跳过 · 保持精简牌组', () => act('reward'), $('#choices'));
  }
  if (run.phase === 'relic') for (const key of run.relicChoices) {
    const relic = config.relics[key], b = button('', () => act('relic', key), $('#choices')); b.className = 'relic-choice'; b.append(art(relic.art));
    const title = document.createElement('strong'); title.textContent = relic.name; const p = document.createElement('p'); p.textContent = relic.description; b.append(title, p);
  }
  if (run.phase === 'rest') {
    if (run.rulesVersion === 1) {
      button(`休息 · 回复${legacyConfig.restHeal}生命`, () => act('rest'), $('#choices'));
      for (const instance of run.deck.filter(c => !c.upgraded && (legacyConfig.cards[c.key].damage || legacyConfig.cards[c.key].block))) cardButton(instance, $('#choices'), () => act('rest', instance.id));
    } else renderRest();
  }
  if (['lost','won'].includes(run.phase)) {
    $('#log').textContent += ` 本局发现${run.discovered?.length || 0}种术式。新一局仍从刀盾起步，奇遇经历与构筑会不同。`;
    button('再登一次 · 新奇遇 / 新构筑', reset, $('#choices'));
  }
  for (const key of new Set(run.deck.map(c => c.key))) for (const upgraded of [false, true]) {
    const copies = run.deck.filter(c => c.key === key && c.upgraded === upgraded); if (!copies.length) continue;
    const b = cardButton(copies[0], $('#deck'), () => {}, true), count = document.createElement('span'); count.className = 'card-quantity'; count.textContent = `×${copies.length}`; b.append(count);
  }
  if (run.rulesVersion === 3) renderEvent();
  renderCombos(); renderBook();
}
function renderBook() {
  $('#atlas').hidden = run.rulesVersion === 1; $('#event-atlas').hidden = run.rulesVersion < 3;
  $('#recipe-book').replaceChildren();
  $('#atlas-heading').textContent = `术式图鉴 · 已发现${knownRecipes.size}/${Object.keys(config.recipes).length}`;
  for (const [key, recipe] of Object.entries(config.recipes)) {
    const item = document.createElement('article'); item.className = 'recipe-entry'; item.append(art(recipe.art));
    const content = document.createElement('div'), title = document.createElement('h3'); title.textContent = `${recipe.name}${knownRecipes.has(key) ? ' · 已发现' : ''}`;
    const formula = document.createElement('p'); formula.textContent = `${recipeFormula(recipe)} → ${recipe.name}`;
    const desc = document.createElement('small'); desc.textContent = `${recipe.description} 释放${recipe.cost}文气。`;
    content.append(title, formula, desc); item.append(content); $('#recipe-book').append(item);
  }
}
function showStarter() {
  if (!config) return;
  const preset = rules().presets?.[run?.starterId || 'beginner'] || config.presets.beginner;
  $('#starter').hidden = false; if (!$('#starter-dialog').open) $('#starter-dialog').showModal(); $('#starter-name').textContent = preset.name; $('#starter-description').textContent = preset.description;
  $('#starter-cards').replaceChildren(); $('#starter-tips').replaceChildren();
  for (const key of new Set(preset.cards)) {
    const b = cardButton({key}, $('#starter-cards'), () => {}, true), count = document.createElement('span'); count.className = 'card-quantity'; count.textContent = `×${preset.cards.filter(k => k === key).length}`; b.append(count);
  }
  for (const tip of preset.strategy) { const li = document.createElement('li'); li.textContent = tip; $('#starter-tips').append(li); }
}
function reset() { if (!config) return; seed = Date.now() >>> 0; run = createRun(config, seed); actions = []; restMode = 'rest'; $('#status').textContent = ''; $('#effect').replaceChildren(); render(); }
$('#starter-open').onclick = () => { $('#menu-dialog').close(); showStarter(); };
$('#starter-close').onclick = () => { $('#starter').hidden = true; $('#starter-dialog').close(); try { localStorage.setItem('hanzi-tower-starter-seen-v3', '1'); } catch {} };
$('#end').onclick = () => act('end');
$('#restart').onclick = () => { if (run && (['lost','won'].includes(run.phase) || confirm('放弃当前试炼并开启新一局？'))) reset(); };
$('#save').onclick = async () => {
  if (!run) return;
  const payload = {version:run.rulesVersion, mode:'tower', seed, actions:structuredClone(actions)};
  if (run.rulesVersion >= 2) { payload.contentVersion = rules().contentVersion; payload.starterId = run.starterId; }
  try { localStorage.setItem('hanzi-tower-save', JSON.stringify(payload)); } catch { $('#status').textContent = '浏览器无法保存，请检查存储空间。'; return; }
  $('#status').textContent = '已保存到浏览器。';
  try { await saveServer(payload); $('#status').textContent = '已保存到浏览器与本地服务。'; } catch { $('#status').textContent = '已保存到浏览器，可在静态网页继续。'; }
};
$('#load').onclick = async () => {
  if (!config) return;
  let saved, restored;
  try { saved = await loadServerSave(); restored = restore(config, saved, legacyConfig, previousConfig); } catch {}
  if (!restored) try { saved = JSON.parse(localStorage.getItem('hanzi-tower-save')); restored = restore(config, saved, legacyConfig, previousConfig); } catch {}
  if (!restored) { $('#status').textContent = '没有可重放的爬塔存档，或该存档内容版本不兼容；教学存档仍在原入口读取。'; return; }
  run = restored; seed = saved.seed; actions = structuredClone(saved.actions); restMode = 'rest'; rememberRecipes(run.discovered || []); $('#effect').replaceChildren(); render();
  $('#starter').hidden = true; $('#starter-dialog').close(); $('#status').textContent = run.rulesVersion < 3 ? '已按旧版原卡组与规则继续；新一局从刀盾开始奇遇成长。' : '已恢复试炼，包括奇遇题目、亲笔卡、术式与遗物。';
};
Promise.all(['data/tower.json', 'data/tower-v1.json', 'data/tower-v2.json', 'data/tower-events.json'].map(url => fetch(url).then(r => { if (!r.ok) throw Error(); return r.json(); }))).then(([data, legacy, previous, library]) => {
  config = {...data, events:library.events}; legacyConfig = legacy; previousConfig = previous;
  renderEventLibrary();
  try { const known = JSON.parse(localStorage.getItem('hanzi-tower-recipes-v2')); if (Array.isArray(known)) for (const key of known) if (typeof key === 'string' && Object.hasOwn(config.recipes, key)) knownRecipes.add(key); } catch {}
  reset();
  let seen = false; try { seen = localStorage.getItem('hanzi-tower-starter-seen-v3') === '1'; } catch {}
  if (!seen) showStarter();
}).catch(() => { $('#status').textContent = '试炼配置加载失败，请刷新重试。'; for (const b of document.querySelectorAll('button')) b.disabled = true; });
const eventNames = {dialogue:'古人对话',quiz:'答题闯关',lament:'灯笺寄意',adventure:'奇景冒险',craft:'借笔制卡',cameo:'小说彩蛋'};
function renderEventLibrary(){
 const counts={}; for(const event of config.events)counts[event.kind]=(counts[event.kind]||0)+1;
 $('#event-atlas').hidden = false; $('#event-atlas-heading').textContent=`奇遇手册 · ${config.events.length}个故事`;
 for(const [kind,count] of Object.entries(counts)){
  const section=document.createElement('section'),title=document.createElement('h3');title.textContent=`${eventNames[kind]} · ${count}`;section.append(title);
  for(const event of config.events.filter(e=>e.kind===kind)){const p=document.createElement('p');p.textContent=`${event.name} · ${event.person}`;section.append(p);}$('#event-book').append(section);
 }
}
function addBuildHint(button,key){
 const complete=Object.keys(config.recipes).filter(recipe=>{const missing=missingIngredients(config,run.deck,recipe);return missing.length===1&&missing[0]===key;}).slice(0,2);
 const hint=document.createElement('span');hint.className='reward-hint';hint.textContent=complete.length?'可补齐：'+complete.map(k=>config.recipes[k].name).join('／'):'入册后'+(run.deck.length+1)+'张';button.append(hint);
}
function renderEvent(){
 if(!run.phase.startsWith('event'))return;
 const state=run.event,event=config.events.find(e=>e.id===state.id),host=$('#choices');
 const panel=document.createElement('article');panel.className='encounter';
 const image=art(event.art,`${eventNames[event.kind]}场景画意`),body=document.createElement('div');panel.append(image,body);
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent=`${eventNames[event.kind]} · ${event.person}`;
 const title=document.createElement('h2');title.textContent=event.name;const scene=document.createElement('p');scene.textContent=event.scene;body.append(eyebrow,title,scene);
 if(event.note){const note=document.createElement('small');note.textContent=event.note;body.append(note);}
 host.append(panel);
 const options=document.createElement('div');options.className='event-options';body.append(options);
 if(state.feedback){const feedback=document.createElement('p');feedback.className='event-feedback';feedback.setAttribute('role','status');feedback.textContent=state.feedback;body.insertBefore(feedback,options);}
 if(run.phase==='event'){
  if(event.kind==='quiz'){
   const question=event.questions[state.step],p=document.createElement('h3');p.textContent=`第${state.step+1}/${event.questions.length}题 · ${question.prompt}`;options.append(p);
   if(state.answered)button(state.step+1===event.questions.length?'查看闯关收获':'继续下一题',()=>act('eventNext'),options);
   else for(const [i,answer]of question.answers.entries())button(answer,()=>act('eventAnswer',i),options);
  }else for(const [i,choice]of event.choices.entries()){
   const b=button(choice.label,()=>act('eventChoice',i),options);
   if(choice.effect.type==='risk'&&run.hp<=choice.effect.cost){b.disabled=true;b.title='当前生命不足以支付风险，请选择其他路线。';}
  }
 }
 if(run.phase==='eventReward'){
  const p=document.createElement('p');p.textContent=`选择一张${state.upgraded?'强化':'普通'}字卡加入牌册，或跳过。`;options.append(p);
  const cards=document.createElement('div');cards.className='event-cards';options.append(cards);
  for(const key of state.choices){const b=cardButton({key,upgraded:state.upgraded},cards,()=>act('eventReward',key));addBuildHint(b,key);}
  button('跳过奖励 · 保持牌册精简',()=>act('eventReward'),options);
 }
 if(run.phase==='eventCraft'){
  const p=document.createElement('p');p.textContent='选择一张字谱，亲自落笔。临摹达标获得强化卡，稳笔辅助获得普通卡。';options.append(p);
  const cards=document.createElement('div');cards.className='event-cards';options.append(cards);
  for(const key of state.choices){const b=cardButton({key},cards,()=>startCraft(key));addBuildHint(b,key);}
 }
 if(run.phase==='eventRemove'){
  if(run.deck.length>config.limits.minimumDeck){const cards=document.createElement('div');cards.className='event-cards';options.append(cards);for(const card of run.deck)cardButton(card,cards,()=>act('eventRemove',card.id));}
  else{const p=document.createElement('p');p.textContent=`牌册须保留至少${config.limits.minimumDeck}张，请保留原册。`;options.append(p);}
  button('保留原册，向主人道别',()=>act('eventRemove'),options);
 }
 if(run.phase==='eventResult')button('收好心意 · 继续登塔',()=>act('eventLeave'),options);
}
let craftKey=null,inkStrokes=[],activeStroke=null,activePointer=null;
function drawCraft(){
 const canvas=$('#craft-canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,360,360);ctx.fillStyle='#eee4cb';ctx.fillRect(0,0,360,360);
 ctx.strokeStyle='#cabc9c';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(180,0);ctx.lineTo(180,360);ctx.moveTo(0,180);ctx.lineTo(360,180);ctx.stroke();ctx.setLineDash([]);
 function strokes(paths,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of paths){ctx.beginPath();stroke.forEach((p,i)=>i?ctx.lineTo(p[0]*3.6,p[1]*3.6):ctx.moveTo(p[0]*3.6,p[1]*3.6));ctx.stroke();}}
 strokes(glyphStrokes[craftKey],'#c5b896',9);strokes(inkStrokes,'#243733',7);
 const score=scoreCraft(craftKey,inkStrokes);$('#craft-feedback').textContent=score?`覆盖${Math.round(score.coverage*100)}% · 准确${Math.round(score.precision*100)}% · ${score.upgraded?'已达到强化标准':'完成后获得普通卡'}`:'尚未落笔；可重写，或使用稳笔辅助。';
}
function startCraft(key){craftKey=key;inkStrokes=[];activeStroke=null;activePointer=null;$('#craft-title').textContent=`亲笔制卡 · 「${config.cards[key].char}」`;drawCraft();$('#craft-dialog').showModal();$('#craft-title').focus();}
function inkPoint(event){const r=$('#craft-canvas').getBoundingClientRect();return [Math.round(Math.max(0,Math.min(100,(event.clientX-r.left)/r.width*100))*10)/10,Math.round(Math.max(0,Math.min(100,(event.clientY-r.top)/r.height*100))*10)/10];}
$('#craft-canvas').onpointerdown=event=>{
 if(activePointer!==null||inkStrokes.length>=32)return;event.preventDefault();activePointer=event.pointerId;activeStroke=[inkPoint(event)];inkStrokes.push(activeStroke);event.currentTarget.setPointerCapture(event.pointerId);drawCraft();
};
$('#craft-canvas').onpointermove=event=>{
 if(event.pointerId!==activePointer||!activeStroke)return;
 if(inkStrokes.reduce((n,s)=>n+s.length,0)>=1600)return;
 const p=inkPoint(event),last=activeStroke.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])<.5)return;activeStroke.push(p);drawCraft();
};
function finishInk(event){if(event.pointerId!==activePointer)return;if(activeStroke?.length===1)inkStrokes.pop();activePointer=null;activeStroke=null;drawCraft();}
$('#craft-canvas').onpointerup=finishInk;$('#craft-canvas').onpointercancel=finishInk;
$('#craft-clear').onclick=()=>{inkStrokes=[];activePointer=null;activeStroke=null;drawCraft();};
$('#craft-cancel').onclick=()=>$('#craft-dialog').close();
$('#craft-assist').onclick=()=>{if(run.phase!=='eventCraft')return;$('#craft-dialog').close();act('eventCraft',{key:craftKey,mode:'assist'});};
$('#craft-submit').onclick=()=>{if(activePointer!==null)return;const score=scoreCraft(craftKey,inkStrokes);if(!score){$('#craft-feedback').textContent='请至少写下有效笔迹，或选择稳笔辅助。';return;}$('#craft-dialog').close();act('eventCraft',{key:craftKey,mode:'hand',strokes:structuredClone(inkStrokes)});};
