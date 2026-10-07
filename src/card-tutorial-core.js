// 新手卡牌规则：赠卡燃尽、两步制卡和亲笔卡牌的状态结算。
export function shuffle(run, cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(run.seed / 4294967296 * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function makeRun(config) {
  const run = { stage: 'gift', encounter: 0, hp: 60, maxHp: 60, seed: 20261001,
    nextId: 3, materials: { thin: 0, tough: 0, cinnabar: 0, pine: 0 }, craftedIds: [], spent: [], craftDraft: null,
    deck: [{id:'card-1',definitionId:'mentorFire',owner:'mentor',star:3,quality:'完美',style:'长者笔迹'}, {id:'card-2',definitionId:'mentorBlade',owner:'mentor',star:3,quality:'完美',style:'长者笔迹'}], log: [] };
  startBattle(run, config); run.stage = 'gift'; return run;
}
export function activeDeck(run) { return run.deck.filter(card => !run.spent.includes(card.id)); }
// 从已使用的赠卡推导束缚，旧版v4存档也能恢复开场状态。
export function isVineBound(run) { return run.encounter === 0 && !run.spent.some(id => ['card-1', 'card-2'].includes(id)); }
export function definition(run, config, id) {
  const instance = run.deck.find(card => card.id === id);
  if (!instance) return null;
  const base = config.cards[instance.definitionId], rankBonus = instance.owner === 'player' && instance.star === 2;
  return { ...base, faceArt: base.faceArtByStar?.[instance.star] || base.faceArt, damage: (base.damage || 0) + (rankBonus ? base.upgrade?.damage || 0 : 0), burn: (base.burn || 0) + (rankBonus ? base.upgrade?.burn || 0 : 0) };
}
export function cardText(card) {
  return `造成${card.damage}伤害${card.burn ? `，施加${card.burn}灼痕` : ''}${card.detonate ? '，引爆全部灼痕，每层额外2伤害' : ''}。${card.oneShot ? '一次性赠卡 · 用后永久燃尽。' : '亲制卡 · 用后可重新抽到，未使用时保留。'}`;
}
export function draw(run, count) {
  const c = run.combat;
  for (let i = 0; i < count && c.hand.length < 10; i++) {
    if (!c.draw.length) { c.draw = shuffle(run, c.discard); c.discard = []; }
    if (!c.draw.length) break;
    c.hand.push(c.draw.shift());
  }
}
export function startBattle(run, config) {
  const enemy = config.enemies[run.encounter];
  const ids = activeDeck(run).map(card => card.id);
  run.combat = { round: 1, energy: 3, block: 0, enemyHp: enemy.hp, burn: 0,
    draw: ids, discard: [], exhaust: [], hand: [], phase: 'player', intent: enemy.attacks[0] };
  run.stage = 'battle'; draw(run, 5); run.log = [enemy.intro];
}
export function acceptGift(run) { if (run.stage !== 'gift') return false; run.stage = 'battle'; return true; }
function outcome(run) {
  if (run.combat.enemyHp <= 0) {
    run.combat.enemyHp = 0;
    run.stage = run.encounter === 0 ? 'craft' : 'complete';
    if (run.stage === 'craft') run.materials = { thin: 1, tough: 1, cinnabar: 1, pine: 1 };
  } else if (run.hp <= 0) { run.hp = 0; run.stage = 'lost'; }
}
export function canPlay(run, config, id) {
  const c = run.combat, card = definition(run, config, id);
  return Boolean(run.stage === 'battle' && c.phase === 'player' && c.hand.includes(id) && card && c.energy >= card.cost && !(run.encounter === 0 && card.detonate && !run.spent.includes('card-1')));
}
export function playCard(run, config, id) {
  if (!canPlay(run, config, id)) return false;
  const c = run.combat, card = definition(run, config, id);
  c.energy -= card.cost; c.hand.splice(c.hand.indexOf(id), 1);
  if (card.oneShot) { c.exhaust.push(id); run.spent.push(id); } else c.discard.push(id);
  let damage = card.damage;
  if (card.detonate && c.burn) { damage += c.burn * 2; c.burn = 0; }
  c.enemyHp -= damage; c.burn += card.burn;
  run.log.push(`打出「${card.char}·${card.name}」，造成${damage}伤害。${card.oneShot ? '长者赠卡化为灰烬。' : '你的亲笔卡进入弃牌堆。'}`);
  outcome(run); return true;
}
export function endTurn(run, config) {
  const c = run.combat;
  // 初次教学只有借火接刀这一条明确路径，未用完赠卡前不催动敌袭。
  if (run.stage !== 'battle' || c.phase !== 'player' || run.encounter === 0) return false;
  for (const id of [...c.hand]) {
    if (!definition(run, config, id).retain) { c.hand.splice(c.hand.indexOf(id), 1); c.discard.push(id); }
  }
  if (c.burn) { c.enemyHp -= c.burn; run.log.push(`灼痕造成${c.burn}伤害。`); c.burn--; }
  outcome(run); if (run.stage === 'battle') c.phase = 'enemy'; return true;
}
export function resolveEnemy(run, config) {
  const c = run.combat;
  if (run.stage !== 'battle' || c.phase !== 'enemy') return false;
  const damage = Math.max(0, c.intent - c.block); run.hp -= damage;
  run.log.push(`妖物攻击${c.intent}，受到${damage}伤害。`); outcome(run);
  if (run.stage !== 'battle') return true;
  c.round++; c.block = 0; c.energy = 3; c.phase = 'player';
  const attacks = config.enemies[run.encounter].attacks; c.intent = attacks[(c.round - 1) % attacks.length]; draw(run, 5); return true;
}
export function craftCard(run, config, recipeId, grade, inkImage) {
  const recipe = config.recipes[run.craftedIds.length];
  if (run.stage !== 'craft' || !recipe || recipe.id !== recipeId || !grade?.accepted || !['完美','逸品'].includes(grade.quality) || ![1,2].includes(grade.star) || (grade.star === 2) !== (grade.quality === '逸品') || !['楷书','行草'].includes(grade.style) || !['长者护持','笔势试炼'].includes(grade.support) || (grade.star === 2 && grade.style !== '行草') || typeof inkImage !== 'string' || !inkImage.startsWith('data:image/png;base64,') || !run.materials[recipe.paper] || !run.materials[recipe.ink]) return false;
  run.materials[recipe.paper]--; run.materials[recipe.ink]--;
  const instance = { id: `card-${run.nextId++}`, definitionId: recipe.id, owner:'player', quality:grade.quality, star:grade.star, style:grade.style, support:grade.support, inkImage };
  run.deck.push(instance); run.craftedIds.push(instance.id); run.craftDraft = null;
  if (run.craftedIds.length === 2) run.stage = 'crafted';
  return instance;
}
export function nextBattle(run, config) {
  if (run.stage !== 'crafted' || run.craftedIds.length !== 2) return false;
  run.encounter = 1; startBattle(run, config); return true;
}
export function validSave(save, config) {
  if (![4,5].includes(save?.version) || save.mode !== 'card-tutorial') return false;
  const r=save.run, stages=['gift','battle','craft','crafted','complete','lost'];
  if (!r || !stages.includes(r.stage) || ![0,1].includes(r.encounter) || !Number.isInteger(r.hp) || r.hp<0 || r.hp>60 || r.maxHp!==60 || !Number.isInteger(r.seed) || r.seed<0 || r.seed>4294967295 || !Number.isInteger(r.nextId) || !Array.isArray(r.deck) || r.deck.length<2 || r.deck.length>4 || !Array.isArray(r.craftedIds) || !Array.isArray(r.spent) || !Array.isArray(r.log) || r.log.some(line=>typeof line!=='string')) return false;
  const ids=r.deck.map(card=>card.id), png=value=>typeof value==='string' && value.startsWith('data:image/png;base64,') && value.length<300000;
  if (new Set(ids).size!==ids.length || r.nextId!==r.deck.length+1 || r.deck.some((card,i)=>card.id!==`card-${i+1}` || card.definitionId!==(i<2?['mentorFire','mentorBlade'][i]:config.recipes[i-2].id) || card.owner!==(i<2?'mentor':'player') || (i<2 ? card.star!==3 || card.quality!=='完美' : !png(card.inkImage) || ![1,2].includes(card.star) || (card.star===2)!==(card.quality==='逸品') || !['完美','逸品'].includes(card.quality) || !['楷书','行草'].includes(card.style) || (card.star===2 && card.style!=='行草')))) return false;
  if (JSON.stringify(r.craftedIds)!==JSON.stringify(ids.slice(2)) || new Set(r.spent).size!==r.spent.length || r.spent.some(id=>!ids.slice(0,2).includes(id))) return false;
  if (!r.materials || ['thin','tough','cinnabar','pine'].some(key=>![0,1].includes(r.materials[key]))) return false;
  const count=r.craftedIds.length;
  if ((r.stage==='craft' && (r.encounter!==0 || count>=2 || r.spent.length!==2)) || (r.stage==='crafted' && (r.encounter!==0 || count!==2 || r.spent.length!==2)) || (r.encounter===1 && (count!==2 || r.spent.length!==2)) || (r.stage==='gift' && (r.encounter!==0 || r.spent.length || count))) return false;
  if (r.craftDraft && (r.stage!=='craft' || r.craftDraft.recipeId!==config.recipes[count]?.id || !['regular','running'].includes(r.craftDraft.style) || typeof r.craftDraft.assisted!=='boolean' || !png(r.craftDraft.inkImage))) return false;
  const session=r.craftDraft?.session;
  if(session && (typeof session.failed!=='boolean' || typeof session.reason!=='string' || (session.aidUsed!==undefined && typeof session.aidUsed!=='boolean') || !(session.deadline===null || Number.isFinite(session.deadline) && session.deadline>0)))return false;
  const c=r.combat;
  if (!c || !['player','enemy'].includes(c.phase) || !Number.isInteger(c.round) || c.round<1 || !Number.isInteger(c.energy) || c.energy<0 || c.energy>3 || !Number.isInteger(c.enemyHp) || c.enemyHp<0 || c.enemyHp>config.enemies[r.encounter].hp || !Number.isInteger(c.block) || c.block<0 || !Number.isInteger(c.burn) || c.burn<0 || c.intent!==config.enemies[r.encounter].attacks[(c.round-1)%config.enemies[r.encounter].attacks.length]) return false;
  const piles=['draw','hand','discard','exhaust']; if(piles.some(key=>!Array.isArray(c[key]))) return false;
  const all=piles.flatMap(key=>c[key]), expected=r.encounter===0?ids.slice(0,2):ids.slice(2);
  return c.hand.length<=10 && new Set(all).size===all.length && all.length===expected.length && all.every(id=>expected.includes(id)) && (r.encounter!==0 || r.spent.every(id=>c.exhaust.includes(id))) && (r.stage!=='craft' && r.stage!=='crafted' && r.stage!=='complete' || c.enemyHp===0);
}
