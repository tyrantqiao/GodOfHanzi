import { createCraftSession, remainingSeconds, manifestation, isRuinedStroke } from './craft-session.js';
import { makeRun, activeDeck, isVineBound, definition, cardText, canPlay, acceptGift, playCard, endTurn, resolveEnemy, craftCard, nextBattle, validSave } from './card-tutorial-core.js';
import { gradeCraft } from './crafting-grade.js';
import { loadLocalSave, loadServerSave, saveLocal, saveServer } from './storage.js';
import { scoreWriting, getWritingScoreRules } from './writing-score.js';
import { playCue } from './sfx.js';
import { speak, stopVoice } from './voice.js';

const $ = selector => document.querySelector(selector);
let config, run, selectedRecipe, busy = false, enemyDue = 0;
const menu = $('#menu'), craft = $('#craft-dialog'), pileDialog = $('#pile-dialog');
const craftResult = document.createElement('dialog'); craftResult.id = 'craft-result'; craftResult.setAttribute('aria-labelledby', 'craft-result-title');
const resultTitle = document.createElement('h2'); resultTitle.id = 'craft-result-title'; resultTitle.textContent = '字卡已成';
const resultImage = document.createElement('img'); resultImage.className = 'result-ink';
const resultGrade = document.createElement('p'); resultGrade.className = 'result-grade'; resultGrade.setAttribute('role', 'status');
const resultContinue = document.createElement('button'); resultContinue.textContent = '收下字卡';
const resultReveal = document.createElement('div'); resultReveal.className = 'result-reveal';
const resultFront = document.createElement('div'); resultFront.className = 'reveal-front'; resultFront.append(resultImage);
const resultBack = document.createElement('div'); resultBack.className = 'reveal-back'; resultBack.setAttribute('aria-hidden','true');
resultReveal.append(resultBack, resultFront);
craftResult.append(resultTitle, resultReveal, resultGrade, resultContinue); document.body.append(craftResult);
resultContinue.addEventListener('click', () => { craftResult.close(); $('#journey-next').focus({preventScroll:true}); });
const binding = document.createElement('div'); binding.className = 'hero-binding'; binding.setAttribute('aria-hidden', 'true'); $('.hero').after(binding);
const bindingBadge = document.createElement('span'); bindingBadge.className = 'binding-badge'; bindingBadge.textContent = '藤蔓缠身'; $('.field').append(bindingBadge);
const readyPortrait = new Image(); readyPortrait.src = 'src/assets/characters/shen-yan-ready-v2.png';
menu.append($('#rank-guide'));
const patternGuide = document.createElement('button'); patternGuide.textContent = '卡纹图鉴'; menu.append(patternGuide);
patternGuide.addEventListener('click', () => {
  $('#pile-title').textContent = '卡纹图鉴'; $('#pile-list').replaceChildren();
  const names=['烟岚山水','青绿江山','钟鼎金石','宋词花笺','赤壁诗卷','金笺山河','星月诗画'];
  const tabs=document.createElement('div'); tabs.className='pattern-tabs';
  const preview=document.createElement('div'); preview.className='pattern-preview';
  const caption=document.createElement('p'); caption.className='pattern-caption';
  function showRank(rank) {
    preview.replaceChildren();
    for(const [side,label] of [['face','正面画意'],['back','卡背']]) { const plate=document.createElement('div');plate.className=`pattern-plate rank-${rank} pattern-${side}`;plate.setAttribute('role','img');plate.setAttribute('aria-label',`${rank}星${label}`);preview.append(plate); }
    caption.textContent=`${rank}星 · ${names[rank-1]}${rank>3?' · 后续等级设计':''}`;
    for(const button of tabs.children) button.setAttribute('aria-pressed',String(Number(button.dataset.rank)===rank));
  }
  const martialTabs=document.createElement('div');martialTabs.className='martial-tabs';martialTabs.setAttribute('aria-label','杀伐画谱');
  const martialScenes=[['battlefield','古战场','长者刀卡'],['bamboo-blades','竹林双刃','亲制刀卡'],['night-swordsman','月夜侠客','后续题材储备']];
  for(const [id,name,usage] of martialScenes){
    const button=document.createElement('button');button.textContent=name;button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{
      for(const rankButton of tabs.children)rankButton.setAttribute('aria-pressed','false');
      for(const sceneButton of martialTabs.children)sceneButton.setAttribute('aria-pressed',String(sceneButton===button));
      const plate=document.createElement('div');plate.className='pattern-plate rank-2 martial-plate';plate.style.backgroundImage=`url('src/assets/cards/martial-${id}.png')`;plate.setAttribute('role','img');plate.setAttribute('aria-label',name);
      preview.replaceChildren(plate);caption.textContent=`${name} · ${usage}`;
    });martialTabs.append(button);
  }
  tabs.addEventListener('click',()=>{for(const button of martialTabs.children)button.setAttribute('aria-pressed','false');});
  const elementGroups=[];
  const elementScenes={
    '火系画谱':[['fire-match','薪火初生'],['fire-torch','一炬照夜'],['fire-united','万炬同心'],['fire-violet','紫焰凝灵'],['fire-sun','金乌曜日']],
    '水系画谱':[['water-orb','掌心水珠'],['water-crystal','玄晶映月'],['water-great-orb','沧海凝珠'],['water-tsunami','怒海卷天'],['water-palace','碧海龙宫']]
  };
  for(const [groupName,scenes] of Object.entries(elementScenes)){
    const group=document.createElement('div');group.className='element-tabs';group.setAttribute('aria-label',groupName);elementGroups.push(group);
    for(const [id,name] of scenes){const button=document.createElement('button');button.textContent=name;button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>{
        for(const other of [...tabs.children,...martialTabs.children,...elementGroups.flatMap(g=>[...g.children])]) other.setAttribute('aria-pressed',String(other===button));
        const plate=document.createElement('div');plate.className=`pattern-plate ${id.startsWith('fire')?'rank-3':'rank-2'} martial-plate`;plate.style.backgroundImage=`url('src/assets/cards/${id}.png')`;plate.setAttribute('role','img');plate.setAttribute('aria-label',name);preview.replaceChildren(plate);
        caption.textContent=`${name} · ${id==='fire-united'?'长者火卡':id==='fire-torch'?'一星亲制火卡':id==='fire-violet'?'二星亲制火卡':'题材储备'}`;
      });group.append(button);
    }
  }
  for(const group of [tabs,martialTabs])group.addEventListener('click',()=>{for(const other of elementGroups.flatMap(g=>[...g.children]))other.setAttribute('aria-pressed','false');});
  for(let rank=1;rank<=7;rank++){const button=document.createElement('button');button.textContent=`${rank}星`;button.dataset.rank=rank;button.addEventListener('click',()=>showRank(rank));tabs.append(button);}
  $('#pile-list').append(tabs,martialTabs,...elementGroups,preview,caption);showRank(1);pileDialog.showModal();
});
const canvas = $('#craft-canvas'), ctx = canvas.getContext('2d');
// 灵光只在字帖外层呈现，不写入评分或存档用的墨迹画布。
const inkRelic = document.createElement('div');
inkRelic.className = 'ink-relic'; inkRelic.dataset.aura = 'quiet';
canvas.before(inkRelic); inkRelic.append(canvas);
const relicCloud = document.createElement('span'); relicCloud.className = 'relic-cloud'; relicCloud.setAttribute('aria-hidden', 'true'); inkRelic.append(relicCloud);
for (let i = 0; i < 12; i++) {
  const mote = document.createElement('i'); mote.className = 'relic-mote'; mote.setAttribute('aria-hidden', 'true');
  mote.style.setProperty('--orbit', `${i * 30}deg`); mote.style.setProperty('--delay', `${-i * .37}s`); inkRelic.append(mote);
}
const relicStatus = document.createElement('span'); relicStatus.className = 'relic-status'; relicStatus.textContent = '静候落墨'; inkRelic.append(relicStatus);
const mask = document.createElement('canvas'), ink = document.createElement('canvas');
mask.width = ink.width = 400; mask.height = ink.height = 400;
const maskCtx = mask.getContext('2d', { willReadFrequently: true }), inkCtx = ink.getContext('2d', { willReadFrequently: true });
const runningMask = document.createElement('canvas'); runningMask.width = runningMask.height = 400;
const runningCtx = runningMask.getContext('2d', { willReadFrequently: true });
let pointer = null, lastPoint = null, draftGeneration = 0;
let craftSession = createCraftSession(), strokeBefore = null, strokePixels = null, lastCraftTick = -1, restoringDraft = false;
const clock = document.createElement('p'); clock.id = 'craft-clock'; $('#craft-card-name').before(clock);
const liveCard = document.createElement('div'); liveCard.className = 'craft-manifestation rank-1'; liveCard.setAttribute('aria-hidden','true');
liveCard.innerHTML = '<span class="craft-back-pattern"></span><span class="craft-face-pattern"></span>';
inkRelic.append(liveCard);
const extendTime = document.createElement('button'); extendTime.textContent='续墨香 · 加15秒（本卡一次）'; clock.after(extendTime);
extendTime.addEventListener('click',()=>{
  updateClock();
  if(!selectedRecipe || craftSession.failed || craftSession.deadline===null || craftSession.aidUsed)return;
  craftSession.deadline+=15000; craftSession.aidUsed=true; snapshotDraft(); updateClock();
});
const paperDamage = document.createElement('span'); paperDamage.className='paper-damage'; paperDamage.setAttribute('aria-hidden','true'); inkRelic.append(paperDamage);
function failCraft(reason) {
  craftSession.failed=true; craftSession.reason=reason; pointer=null; lastPoint=null;
  inkRelic.dataset.aura='ruined'; liveCard.dataset.aura='ruined';
  relicStatus.textContent='墨路已断 · 此纸难成'; $('#craft-score').textContent=reason;
  $('#craft-confirm').disabled=true; $('#rewrite').textContent='重新铺纸';
  playCue('slash'); snapshotDraft();
}
function updateClock() {
  if (!selectedRecipe || run?.stage!=='craft' || restoringDraft) return;
  const seconds=remainingSeconds(craftSession,Date.now());
  const total=selectedRecipe.timeLimit+selectedRecipe.tutorialBonus;
  clock.textContent=craftSession.failed ? '此纸已废 · 重新铺纸再试' : seconds===null ? '落笔开始计时 · '+total+'秒（护持 +10秒）' : '墨时余 '+seconds+' 秒 · 重写不续时';
  clock.dataset.urgent=String(seconds!==null && seconds<=5);
  extendTime.disabled=craftSession.failed || craftSession.deadline===null || Boolean(craftSession.aidUsed);
  extendTime.textContent=craftSession.aidUsed?'续墨香已用尽':'续墨香 · 加15秒（本卡一次）';
  if (!craftSession.failed && seconds===0) {
    if(pointer!==null)checkStroke();
    pointer=null;lastPoint=null;
    if(craftSession.failed)return;
    if(currentGrade().accepted) finishCraft();
    else failCraft(markStats().pixels ? '墨时已尽，字卡未成。纸墨未扣，可重新铺纸。' : '尚未落墨，墨时已尽。');
  } else if(craft.open && !craftSession.failed && seconds!==null && seconds<=5 && seconds!==lastCraftTick) playCue('draw');
  lastCraftTick=seconds;
}
setInterval(updateClock,100);
function stars(item) { return `${'★'.repeat(item.star)} ${item.star}星 · ${item.quality}`; }
function briefEffect(card) {
  return [`伤害 ${card.damage}`, card.burn ? `灼痕 +${card.burn}` : '', card.detonate ? '引爆灼痕 ×2' : ''].filter(Boolean).join(' · ');
}
function inkSource(item) { return item.owner === 'mentor' ? `src/assets/${config.cards[item.definitionId].inkAsset}` : item.inkImage; }
function cardButton(id) {
  const item = run.deck.find(card => card.id === id), card = definition(run, config, id);
  const button = document.createElement('button');
  button.className = `card rank-${item.star} quality-${item.quality === '逸品' ? 'exquisite' : 'perfect'}${item.owner === 'player' ? ' crafted' : ' borrowed'}`;
  if(card.faceArt) button.style.setProperty('--face-art',`url('${new URL(`src/assets/cards/${card.faceArt}`,document.baseURI).href}')`);
  const seal = document.createElement('span'); seal.className = 'rank-seal'; seal.setAttribute('aria-hidden','true'); button.append(seal);
  button.dataset.card = id;
  button.disabled = busy || !canPlay(run, config, id);
  button.setAttribute('aria-label', `打出${card.char}·${card.name}，${card.cost}文气，${item.owner === 'mentor' ? '长者一次性赠卡' : '亲制卡'}`);
  for (const [className, text] of [['card-cost', card.cost], ['card-rank', `${'★'.repeat(item.star)} · ${item.quality}`], ['card-title', card.name], ['card-text', briefEffect(card)], ['card-note', item.owner === 'mentor' ? '一次性' : '亲笔 · 可再抽']]) {
    const span = document.createElement('span'); span.className = className; span.textContent = text; button.append(span);
  }
  const img = document.createElement('img'); img.className = 'card-handwriting'; img.src = inkSource(item); img.alt = `${item.owner === 'mentor' ? '陆青崖' : '沈砚'}亲笔「${card.char}」`; button.insertBefore(img, button.querySelector('.card-title'));
  return button;
}
function render() {
  document.body.dataset.stage = run.stage;
  const c = run.combat, enemy = config.enemies[run.encounter];
  const wasBound = document.body.dataset.bound === 'true', bound = isVineBound(run);
  document.body.dataset.bound = String(bound);
  document.body.dataset.enemyDefeated = String(c.enemyHp === 0);
  bindingBadge.hidden = !bound;
  const heroAsset = bound ? 'src/assets/characters/shen-yan-bound-v2.png' : 'src/assets/characters/shen-yan-ready-v2.png';
  if ($('.hero').getAttribute('src') !== heroAsset) $('.hero').src = heroAsset;
  $('.hero').alt = bound ? '沈砚被藤蔓缠绕，俯身受困' : '主角沈砚';
  if(wasBound && !bound) {
    binding.classList.add('breaking'); bindingBadge.textContent = '束缚已解'; bindingBadge.hidden = false;
    setTimeout(() => { binding.classList.remove('breaking'); bindingBadge.textContent = '藤蔓缠身'; bindingBadge.hidden = !isVineBound(run); }, 1100);
  }
  $('#chapter-title').textContent = run.stage === 'craft' || run.stage === 'crafted' ? '二 · 亲笔成双' : run.encounter === 0 ? '一 · 借卡脱险' : '三 · 以己字迎敌';
  $('#objective').textContent = run.stage === 'complete' ? '新手关完成 · 火刀双卡已入册' : `目标：${run.stage === 'gift' ? '接过长者两张一次性字卡' : run.stage === 'craft' ? `亲制火、刀两张卡（${run.craftedIds.length}/2）` : run.stage === 'crafted' ? '携亲笔双卡前往残碑' : `击退${enemy.name}`}`;
  $('#enemy-name').textContent = enemy.name;
  $('#enemy-hp').textContent = `气血 ${c.enemyHp} / ${enemy.hp}`;
  $('#intent').textContent = c.enemyHp === 0 ? '已击退' : run.encounter === 0 ? '长者护阵' : `将攻击 ${c.intent}`;
  $('#enemy-states').textContent = c.burn ? `灼痕 ${c.burn}` : '';
  $('#hero-status').textContent = `气血 ${run.hp}/60${c.block ? ` · 格挡 ${c.block}` : ''}`;
  $('#energy').textContent = `文气 ${'●'.repeat(c.energy)}${'○'.repeat(3 - c.energy)}`;
  $('#round').textContent = `${c.round}回合 · ${c.phase === 'enemy' ? '敌方' : '我方'}`;
  $('#lesson-text').textContent = run.stage === 'craft' ? `赠卡已经燃尽。老夫替你护住墨路，先火后刀，亲制两张。当前已成${run.craftedIds.length}张。` : run.stage === 'crafted' ? '这两张卡的主字，就是你刚才写下的笔迹。自制卡用后可再次抽到。' : run.stage === 'complete' ? '借来的卡会燃尽，亲笔写成的字才是你的力量。火刀双卡，今日入门。' : run.stage === 'lost' ? '我们再来一次，看看火与刀的先后顺序。' : run.encounter === 0 && run.spent.length === 1 ? '火卡已经燃尽。接着使用老夫的刀卡，引爆灼痕，斩开霜藤。' : c.round > 1 ? '亲制卡会从弃牌堆重新抽回。先火再刀；未用的卡会留在手中。' : enemy.intro;
  $('#hand').replaceChildren(...(run.stage === 'battle' ? c.hand.map(cardButton) : []));
  $('.lesson').hidden = run.stage !== 'battle';
  if(run.stage === 'battle') $('#lesson-text').textContent = run.encounter === 0 ? (run.spent.length ? '束缚已解。再用「刀」击退霜藤。' : '用「火」烧断身上的藤蔓。') : '先火后刀，文气用尽后结束回合。';
  $('#hand').hidden = run.stage !== 'battle';
  $('.round-meta').hidden = run.stage === 'gift';
  $('.piles').hidden = run.stage === 'gift';
  $('.enemy-status').hidden = run.stage === 'gift';
  $('#end-turn').disabled = busy || run.stage !== 'battle' || c.phase !== 'player' || run.encounter === 0;
  $('#end-turn').textContent = run.encounter === 0 ? '先用赠卡破藤' : c.phase === 'enemy' ? '妖物行动中' : '结束回合';
  $('#end-turn').hidden = run.encounter === 0 || run.stage !== 'battle';
  for (const button of document.querySelectorAll('[data-pile]')) {
    const key = button.dataset.pile, labels = { draw: '抽牌堆', discard: '弃牌堆', exhaust: '燃尽区', deck: '牌册' };
    button.textContent = `${labels[key]} ${key === 'deck' ? activeDeck(run).length : c[key].length}`;
  }
  $('#log').textContent = run.stage === 'gift' ? '' : run.log.at(-1) || '';
  $('#journey').hidden = run.stage === 'battle';
  const messages = {
    gift: ['长者赠卡', '「藤蔓缠身，收下字卡脱险。」', '接过字卡'],
    craft: ['亲笔制卡', `长者护持 · 已成 ${run.craftedIds.length}/2`, run.craftedIds.length ? '写「刀」' : '写「火」'],
    crafted: ['双卡已成', '带上自己的字，继续前行。', '前往残碑'],
    complete: ['入门完成', '火刀双卡，已入牌册。', '再练一次'],
    lost: ['此战失守', '留心敌人的攻势。', '再试一次']
  };
  if (messages[run.stage]) {
    const [title, copy, action] = messages[run.stage];
    $('#journey-title').textContent = title; $('#journey-copy').textContent = copy; $('#journey-next').textContent = action;
  }
}
function showEffect(card) {
  const enemySprite = $('.enemy'); enemySprite.classList.remove('enemy-hit');
  // 重启命中动画，每次施法均有清晰后退反馈。
  void enemySprite.offsetWidth; enemySprite.classList.add('enemy-hit');
  setTimeout(() => enemySprite.classList.remove('enemy-hit'), 450);
  const node = document.createElement(card.art ? 'img' : 'span');
  node.className = card.art ? 'cast-art' : 'cast-glyph';
  if (card.art) { node.src = `src/assets/${card.art}`; node.alt = ''; } else node.textContent = card.char;
  $('#effect').append(node); setTimeout(() => node.remove(), 950);
  playCue(card.char === '火' ? 'fire' : card.char === '刀' ? 'slash' : 'draw');
}
$('#hand').addEventListener('click', event => {
  const button = event.target.closest('[data-card]');
  if (!button || busy || menu.open || craft.open || pileDialog.open) return;
  const id = button.dataset.card;
  const card = definition(run, config, id);
  if (!playCard(run, config, id)) return;
  busy = true; showEffect(card); render();
  setTimeout(() => {
    busy = false; render();
    if (!menu.open && !craft.open && !pileDialog.open) {
      const next = $('#hand').querySelector('button:not(:disabled)') || (run.stage === 'battle' ? $('#end-turn') : $('#journey-next'));
      next?.focus({ preventScroll: true });
    }
  }, 500);
});
$('#end-turn').addEventListener('click', () => {
  if (busy || !endTurn(run, config)) return;
  enemyDue = 900; render();
});
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now(), elapsed = Math.min(150, now - lastTick); lastTick = now;
  if (!run || document.hidden || menu.open || craft.open || pileDialog.open || run.stage !== 'battle' || run.combat.phase !== 'enemy') return;
  enemyDue -= elapsed;
  if (enemyDue <= 0) { resolveEnemy(run, config); render(); }
}, 100);
$('#menu-open').addEventListener('click', () => menu.showModal());
$('#resume').addEventListener('click', () => menu.close());
function reset() { stopVoice(); run = makeRun(config); busy = false; enemyDue = 0; $('#effect').replaceChildren(); render(); }
$('#new-run').addEventListener('click', () => { reset(); menu.close(); });
$('#journey-next').addEventListener('click', () => {
  if (run.stage === 'gift') { acceptGift(run); render(); speak('先火后刀，借字脱险。', 'mentor', { interrupt: true }); }
  else if (run.stage === 'craft') openCraft();
  else if (run.stage === 'crafted') { nextBattle(run, config); render(); speak('亲制卡已入手，试试你的新战法。', 'mentor', { interrupt: true }); }
  else reset();
});
document.querySelectorAll('[data-pile]').forEach(button => button.addEventListener('click', () => {
  const key = button.dataset.pile;
  $('#pile-title').textContent = button.textContent;
  const ids = key === 'deck' ? activeDeck(run).map(card => card.id) : run.combat[key];
  $('#pile-list').replaceChildren();
  for (const id of ids) {
    const card = definition(run, config, id), item = run.deck.find(card => card.id === id), row = document.createElement('div');
    row.className = `pile-row rank-${item.star}`;
    const image = document.createElement('img'); image.src = inkSource(item); image.alt = `${item.owner === 'mentor' ? '长者' : '沈砚'}亲笔${card.char}`;
    if(card.faceArt){image.style.backgroundImage=`linear-gradient(#f8f1e299,#f8f1e277),url('src/assets/cards/${card.faceArt}')`;image.style.backgroundSize='cover';}
    const text = document.createElement('p'); text.textContent = `${stars(item)} · ${card.char}·${card.name} · ${item.style} — ${cardText(card)}${run.spent.includes(id) ? '（已永久燃尽）' : ''}`;
    row.append(image, text); $('#pile-list').append(row);
  }
  if (!ids.length) $('#pile-list').textContent = '这里暂时没有字卡。';
  pileDialog.showModal();
}));
$('#pile-close').addEventListener('click', () => pileDialog.close());
$('#save').addEventListener('click', async () => {
  const payload = { version: 5, mode: 'card-tutorial', run: structuredClone(run) };
  let local = false, server = false;
  try { saveLocal(payload); local = true; } catch {}
  try { await saveServer(payload); server = true; } catch {}
  $('#save-status').textContent = server && local ? '已保存到本机和服务端。' : local ? '已保存到本机；服务端暂不可用。' : server ? '已保存到服务端；本机存储不可用。' : '保存失败，请检查存储空间。';
});
$('#load').addEventListener('click', async () => {
  let saved = null;
  try { const server = await loadServerSave(); if (validSave(server, config)) saved = server; } catch {}
  if (!saved) { const local = loadLocalSave(); if (validSave(local, config)) saved = local; }
  if (!saved) { $('#save-status').textContent = '没有可读取的双卡教学存档。上一版v3教学存档需重走新关；旧版v2仍可在旧版入口读取。'; return; }
  stopVoice(); run = structuredClone(saved.run); busy = false; enemyDue = 900; $('#effect').replaceChildren(); render();
  $('#save-status').textContent = '已恢复牌堆、敌人意图与制卡进度。';
});
function buildTemplate() {
  maskCtx.clearRect(0, 0, 400, 400); maskCtx.fillStyle = '#000';
  maskCtx.font = '300px KaiTi, STKaiti, SimSun, serif'; maskCtx.textAlign = 'center'; maskCtx.textBaseline = 'middle'; maskCtx.fillText(selectedRecipe.char, 200, 215);
  runningCtx.clearRect(0, 0, 400, 400); runningCtx.strokeStyle = '#000'; runningCtx.lineCap = 'round'; runningCtx.lineJoin = 'round';
  for (const stroke of config.freehandTemplates[selectedRecipe.char]) { runningCtx.lineWidth = stroke.width; runningCtx.stroke(new Path2D(stroke.path)); }
}
function snapshotDraft() {
  if (run.stage !== 'craft' || !selectedRecipe) return;
  run.craftDraft = { recipeId: selectedRecipe.id, style: 'regular', assisted: true, inkImage: ink.toDataURL('image/png'), session: { ...craftSession } };
}
function rebuildTemplate() {
  if (craftSession.failed) craftSession={...createCraftSession(),aidUsed:Boolean(craftSession.aidUsed)};
  draftGeneration++; pointer = null; lastPoint = null; buildTemplate();
  inkCtx.clearRect(0, 0, 400, 400);
  $('#craft-score').textContent = '落笔即可，长者护持。';
  renderCanvas(); snapshotDraft();
  updateRelicAura();
}
function renderCanvas() {
  ctx.clearRect(0, 0, 400, 400); ctx.fillStyle = '#f8f1e2'; ctx.fillRect(0, 0, 400, 400);
  ctx.strokeStyle = '#77846a44'; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(400, 200); ctx.moveTo(200, 0); ctx.lineTo(200, 400); ctx.moveTo(0, 0); ctx.lineTo(400, 400); ctx.moveTo(400, 0); ctx.lineTo(0, 400); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = .13; ctx.drawImage(mask, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(ink, 0, 0);
}
function matchedWriting() {
  const pixels = inkCtx.getImageData(0, 0, 400, 400).data;
  const regular = scoreWriting(maskCtx.getImageData(0, 0, 400, 400).data, pixels, getWritingScoreRules('tutorial'));
  const running = scoreWriting(runningCtx.getImageData(0, 0, 400, 400).data, pixels, getWritingScoreRules('tutorial'));
  // 仅对照已有范本探索笔势，不声称识别任意书法字体。
  return running.coverage >= .5 && running.precision >= .7 && running.tier !== 'flooded'
    ? { score: running, style: 'running' } : { score: regular, style: 'regular' };
}
function getScore() { return matchedWriting().score; }
function markStats() {
  const pixels = inkCtx.getImageData(0, 0, 400, 400).data;
  let count=0, minX=400, maxX=0, minY=400, maxY=0;
  for(let i=3;i<pixels.length;i+=4) if(pixels[i]>32) { const p=(i-3)/4, x=p%400,y=Math.floor(p/400); count++; minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y); }
  return {pixels:count,span:Math.max(maxX-minX,maxY-minY)};
}
function currentGrade() { const match = matchedWriting(); return gradeCraft(match.score, markStats(), match.style); }
function updateRelicAura() {
  const score = getScore(), mark = markStats();
  const unstable=pointer!==null && strokeBefore?.coverage>=.2 && strokeBefore.precision>=.6 && strokeBefore.precision-score.precision>=.08;
  const aura=craftSession.failed ? 'ruined' : unstable ? 'unstable' : manifestation(score,mark);
  inkRelic.dataset.aura=aura; liveCard.dataset.aura=aura;
  relicStatus.textContent={quiet:'静候落墨',protected:'墨路初凝',gathering:'金纹渐起',treasure:'画意将成 · 收笔可落印',unstable:'墨势散了 · 留神收笔',ruined:'墨路已断 · 此纸难成'}[aura];
  $('#craft-confirm').disabled=craftSession.failed;
  $('#rewrite').textContent=craftSession.failed?'重新铺纸':'重写（不续时）';

}
function updateGrade() {
  updateRelicAura();
  if(craftSession.failed){ $('#craft-score').textContent=craftSession.reason; return; }
  const grade=currentGrade();
  $('#craft-score').textContent = grade.accepted ? '墨路已凝，可落印。' : '继续落笔，收住墨势。';
}
async function openCraft() {
  restoringDraft=true;
  selectedRecipe = config.recipes[run.craftedIds.length];
  const draft = run.craftDraft;
  craftSession=draft?.session ? {...draft.session} : createCraftSession(); lastCraftTick=-1;
  const artwork=config.cards[selectedRecipe.id].faceArt;
  liveCard.style.setProperty('--face-art',"url('src/assets/cards/"+artwork+"')");
  $('#craft-title').textContent = `写「${selectedRecipe.char}」 · ${run.craftedIds.length+1}/2`;
  $('#recipes').textContent = run.craftedIds.length ? '✓ 火 → 刀' : '火 → 刀';
  const card=config.cards[selectedRecipe.id];
  $('#craft-card-name').textContent = `${card.char}·${card.name} · ${card.cost}文气`;
  $('#craft-preview').textContent = briefEffect(card);
  $('#craft-materials').textContent = selectedRecipe.name;
  const token=++draftGeneration; pointer=null; lastPoint=null; buildTemplate(); inkCtx.clearRect(0,0,400,400); renderCanvas();
  updateRelicAura();
  craft.showModal(); canvas.focus({ preventScroll: true }); craft.scrollTop = 0; speak('墨路由老夫护持，你只管落笔。', 'mentor', { interrupt: true });
  $('#craft-score').textContent = '落笔即可，长者护持。';
  if(draft) {
    const image = new Image(); image.src=draft.inkImage;
    try { await image.decode(); if(token!==draftGeneration || !craft.open) return; inkCtx.drawImage(image,0,0); renderCanvas(); updateGrade(); } catch { $('#craft-score').textContent='未完成的笔迹无法恢复，可重新落笔；材料尚未扣除。'; }
  }
  restoringDraft=false; updateClock(); if(selectedRecipe)updateGrade();
}
$('#rewrite').addEventListener('click', rebuildTemplate);
$('#craft-close').addEventListener('click', () => craft.close());
craft.addEventListener('close', () => { snapshotDraft(); draftGeneration++; pointer=null; lastPoint=null; restoringDraft=false; });
function point(event) { const rect=canvas.getBoundingClientRect(); return {x:(event.clientX-rect.left)/rect.width*400,y:(event.clientY-rect.top)/rect.height*400}; }
canvas.addEventListener('pointerdown', event => {
  if(pointer!==null)return;
  if(craftSession.failed)return;
  updateClock(); if(!selectedRecipe || craftSession.failed)return;
  if(craftSession.deadline===null)craftSession.deadline=Date.now()+(selectedRecipe.timeLimit+selectedRecipe.tutorialBonus)*1000;
  strokeBefore=getScore(); strokePixels=inkCtx.getImageData(0,0,400,400).data;
  event.preventDefault(); pointer=event.pointerId; canvas.setPointerCapture(pointer); lastPoint=point(event);
  inkCtx.fillStyle='#263a30'; inkCtx.beginPath(); inkCtx.arc(lastPoint.x,lastPoint.y,7,0,Math.PI*2); inkCtx.fill(); renderCanvas();
});
canvas.addEventListener('pointermove', event => {
  if(event.pointerId!==pointer)return;
  updateClock(); if(event.pointerId!==pointer)return;
  const next=point(event); inkCtx.strokeStyle='#263a30'; inkCtx.lineWidth=event.pointerType==='pen'?8+event.pressure*24:24;
  inkCtx.lineCap='round'; inkCtx.lineJoin='round'; inkCtx.beginPath(); inkCtx.moveTo(lastPoint.x,lastPoint.y); inkCtx.lineTo(next.x,next.y); inkCtx.stroke(); lastPoint=next; renderCanvas();
  queueRelicAura();
});
let relicFrame = 0, relicUpdatedAt = 0;
function queueRelicAura() {
  if (relicFrame) return;
  relicFrame = requestAnimationFrame(now => { relicFrame = 0; if (now - relicUpdatedAt < 100) return; relicUpdatedAt = now; updateRelicAura(); });
}
function checkStroke() {
  const after=getScore(), pixels=inkCtx.getImageData(0,0,400,400).data;
  const regular=maskCtx.getImageData(0,0,400,400).data, running=runningCtx.getImageData(0,0,400,400).data;
  let added=0,matched=0;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>32 && strokePixels[i]<=32){added++;if(regular[i]>32 || running[i]>32)matched++;}
  if(isRuinedStroke(strokeBefore,after,added,matched,after.tier==='flooded'))failCraft('末笔散墨，金纹已断。纸墨未扣，可重新铺纸。');
}
function endStroke(event) {
  if(event.pointerId!==pointer)return;
  if(event.type==='pointerup')checkStroke();
  pointer=null;lastPoint=null;
  updateGrade(); snapshotDraft(); updateClock();
}
canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);canvas.addEventListener('lostpointercapture',endStroke);
function finishCraft() {
  if(pointer!==null || craftSession.failed || !selectedRecipe)return;
  const grade=currentGrade(); if(!grade.accepted){$('#craft-score').textContent=grade.message;return;}
  const image=document.createElement('canvas'); image.width=image.height=256;image.getContext('2d').drawImage(ink,0,0,256,256);
  const instance=craftCard(run,config,selectedRecipe.id,grade,image.toDataURL('image/png'));
  if(!instance){$('#craft-score').textContent='材料不足，或这张卡已完成。';return;}
  selectedRecipe=null;craft.close();render();
  resultTitle.textContent = `「${config.cards[instance.definitionId].char}」字卡已成`;
  craftResult.className = `rank-${instance.star} quality-${instance.quality === '逸品' ? 'exquisite' : 'perfect'}`;
  const faceArt = definition(run,config,instance.id).faceArt;
  if(faceArt)craftResult.style.setProperty('--face-art',`url('${new URL(`src/assets/cards/${faceArt}`,document.baseURI).href}')`);else craftResult.style.removeProperty('--face-art');
  resultReveal.classList.remove('revealed');
  resultImage.src = instance.inkImage; resultImage.alt = '刚刚写下的亲笔墨迹';
  resultGrade.textContent = `${instance.star}星 · ${instance.quality}`;
  craftResult.showModal(); resultContinue.focus({preventScroll:true});
  requestAnimationFrame(() => resultReveal.classList.add('revealed'));
  playCue('seal');
  if(run.stage==='crafted') speak('火刀已成，笔迹就是你的卡。','mentor',{interrupt:true});
}
$('#craft-confirm').addEventListener('click',()=>{updateClock();if(selectedRecipe)finishCraft();});
$('#rank-guide').addEventListener('click', () => {
  $('#pile-title').textContent='卡阶与书写品质';$('#pile-list').replaceChildren();
  const intro=document.createElement('p');intro.textContent='一星到七星代表卡片结构，不等同于制卡品质。长者护持助你完美成卡；落笔自有变化，不妨探索自己的笔势。';$('#pile-list').append(intro);
  for(const rank of config.ranks){const row=document.createElement('div');row.className='pile-row';row.textContent=`${'★'.repeat(rank.star)} ${rank.star}星 · ${rank.name}：${rank.description}`;$('#pile-list').append(row);}
  pileDialog.showModal();
});
async function init() {
  const response = await fetch('data/tutorial-cards.json');
  if (!response.ok) throw new Error('字谱加载失败');
  config = await response.json(); reset();
}
init().catch(() => { $('#lesson-text').textContent = '字谱加载失败，请刷新重试。'; $('#end-turn').disabled = true; $('#menu-open').disabled = true; });

