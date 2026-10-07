import { applyAction as previousAction, restore as previousRestore } from './tower-core-v2.js';
import { openEvent, eventAction } from './tower-events.js';
import { shuffle } from './card-tutorial-core.js';
import { applyAction as legacyAction, restore as legacyRestore } from './tower-core-v1.js';
import { leaveMark, fuse, abandonSkill } from './tower-combos.js';

export function createRun(config, seed = Date.now() >>> 0, starterId = 'beginner') {
  if (!Object.hasOwn(config.presets, starterId)) throw new Error('未知开局牌组');
  const starter = config.presets[starterId].cards;
  const run = { rulesVersion: 3, starterId, floor: 0, phase: 'route', hp: config.maxHp, maxHp: config.maxHp, seed,
    deck: starter.map((key, i) => ({ id: i + 1, key, upgraded: false })), nextId: starter.length + 1,
    routes: [...config.routeSchedule[0]], rewards: [], relics: [], relicChoices: [], craftChoices: [], discovered: [], eliteRelic: false,
    seenEvents: [], event: null, boss: null, combat: null, log: '收好初行牌册，开始登塔。' };
  run.boss = shuffle(run, config.bosses)[0];
  run.relics = config.initialRelics === false ? [] : [shuffle(run, Object.keys(config.relics))[0]];
  return run;
}
export function cardInfo(config, card) {
  const info = { ...config.cards[card.key] };
  if (card.upgraded) {
    if (info.upgrade) for (const [key, value] of Object.entries(info.upgrade)) info[key] = (info[key] || 0) + value;
    else for (const key of ['damage', 'block']) if (info[key]) info[key] += config.upgradeBonus;
  }
  return info;
}
export function enemyIntent(run) {
  const c = run.combat, index = (c.round - 1) % c.enemy.attacks.length;
  return { attack: Math.max(0, c.enemy.attacks[index] - c.weaken), base: c.enemy.attacks[index], armor: c.armor || 0 };
}
function hasRelic(run, key) { return run.relics.includes(key); }
function charge(run, config, count) { run.combat.charge = Math.min(config.limits.charge, run.combat.charge + count); }
function burn(run, count) {
  if (!count) return;
  const c = run.combat;
  if (hasRelic(run, 'cinnabar') && !c.flags.cinnabar) { count++; c.flags.cinnabar = true; }
  c.burn += count;
}
export function drawCards(run, count) {
  const c = run.combat;
  while (count-- > 0 && c.hand.length < 10) {
    if (!c.draw.length) {
      if (!c.discard.length) break;
      c.draw = shuffle(run, c.discard); c.discard = [];
      if (hasRelic(run, 'bookmark') && !c.flags.bookmark) { c.flags.bookmark = true; count++; }
    }
    c.hand.push(c.draw.shift());
  }
}
function openRelics(run, config) {
  run.phase = 'relic';
  run.relicChoices = shuffle(run, Object.keys(config.relics).filter(key => !run.relics.includes(key))).slice(0, 3);
  run.log = '选择一件遗物，本局生效。';
}
export function chooseRoute(run, config, type) {
  if (run.phase !== 'route' || !run.routes.includes(type)) return false;
  run.floor++;
  if (type === 'event') { openEvent(run, config); return true; }
  if (type === 'treasure') { openRelics(run, config); return true; }
  if (type === 'rest') { run.phase = 'rest'; run.craftChoices = []; return true; }
  const base = type === 'boss' ? run.boss : shuffle(run, config.enemies)[0];
  const s = config.scaling, elite = type === 'elite';
  const enemy = { ...base, hp: base.hp + (type === 'boss' ? 0 : run.floor * s.hpPerFloor + (elite ? s.eliteHp : 0)),
    attacks: base.attacks.map(n => n + (type === 'boss' || n === 0 ? 0 : run.floor * s.attackPerFloor + (elite ? s.eliteAttack : 0))) };
  run.combat = { enemy, elite, enemyHp: enemy.hp, armor: enemy.armors?.[0] || 0, round: 1, energy: config.energy,
    block: hasRelic(run, 'paperweight') ? 5 : 0, burn: 0, weaken: 0, charge: 0, retainBlock: 0, burnDecay: false,
    hand: [], draw: shuffle(run, run.deck.map(c => c.id)), discard: [], exhaust: [], marks: [], nextMark: 1,
    stamped: [], skill: null, fusions: 0, releases: 0, flags: {} };
  run.phase = 'battle'; run.log = '观察意图，打出字卡；字印可凝成组合术式。'; drawCards(run, config.handSize); return true;
}
function finishBattle(run, config) {
  if (run.combat.enemyHp > 0) return false;
  run.combat.enemyHp = 0; run.combat.marks = []; run.combat.skill = null;
  if (run.floor === config.floors) { run.phase = 'won'; run.log = '九层登顶，本次试炼完成。'; }
  else { run.phase = 'reward'; run.rewards = ['blade', 'shield']; run.hp = Math.min(run.maxHp, run.hp + config.battleHeal); run.log = `战后回复${config.battleHeal}生命。可选基础刀盾；强力字卡在奇遇中获得。`; }
  return true;
}
function directDamage(c, value) {
  const absorbed = Math.min(c.armor, value); c.armor -= absorbed;
  const damage = Math.max(0, value - absorbed); c.enemyHp -= damage; return damage;
}
function effects(run, config, card) {
  const c = run.combat;
  let damage = card.damage || 0;
  if (card.blockDamage) damage += c.block;
  if (card.chargeDamage && !card.consumeCharge) { damage += c.charge * card.chargeDamage; c.charge = 0; }
  if (card.consumeCharge) { const count = Math.min(c.charge, card.consumeCharge); c.charge -= count; damage += count * card.chargeDamage; }
  if (card.consumeBurn) { const count = Math.min(c.burn, card.consumeBurn); c.burn -= count; damage += count * card.burnDamage; }
  const detonated = card.detonate && c.burn > 0;
  if (detonated) { damage += c.burn * 2; c.burn = 0; }
  let actual = 0;
  for (let n = 0; n < (card.hits || 1) && c.enemyHp > 0; n++) actual += directDamage(c, damage);
  if (card.halveBlock) c.block = Math.floor(c.block / 2);
  if (c.enemyHp <= 0) return actual;
  c.block += (card.block || 0) + (card.burningBlock && c.burn ? card.burningBlock : 0)
    + (card.heavyBlock && enemyIntent(run).base >= 12 ? card.heavyBlock : 0);
  c.weaken += card.weaken || 0;
  burn(run, card.burn || 0);
  if (card.charge) charge(run, config, card.charge);
  c.retainBlock = Math.max(c.retainBlock, card.retainBlock || 0);
  if (card.burnDecay) c.burnDecay = true;
  if (detonated && hasRelic(run, 'emberLamp') && !c.flags.emberLamp) { c.flags.emberLamp = true; burn(run, 2); }
  if (card.draw) drawCards(run, card.draw);
  return actual;
}
export function play(run, config, arg) {
  const id = typeof arg === 'object' && arg !== null ? arg.id : arg;
  const c = run.combat, instance = run.deck.find(card => card.id === id);
  if (run.phase !== 'battle' || !instance || !c.hand.includes(id)) return false;
  const card = cardInfo(config, instance), targets = typeof arg === 'object' && arg !== null ? arg.targets : undefined;
  if (card.cost > c.energy) return false;
  if (card.scry && (!Array.isArray(targets) || targets.length !== Math.min(1, c.draw.length) || targets.some(t => !c.draw.slice(0, card.scry).includes(t)))) return false;
  if (card.exchange && (!Array.isArray(targets) || targets.length > card.exchange || new Set(targets).size !== targets.length || targets.some(t => t === id || !c.hand.includes(t)))) return false;
  c.energy -= card.cost; c.hand.splice(c.hand.indexOf(id), 1); (card.exhaust ? c.exhaust : c.discard).push(id);
  const damage = effects(run, config, card);
  if (finishBattle(run, config)) return true;
  if (card.scry && targets.length) { c.draw.splice(c.draw.indexOf(targets[0]), 1); c.draw.unshift(targets[0]); }
  if (card.exchange) {
    for (const target of targets) { c.hand.splice(c.hand.indexOf(target), 1); c.discard.push(target); }
    drawCards(run, targets.length + 1);
  }
  if (card.cost === 2 && card.type === 'attack' && hasRelic(run, 'bladeCase') && !c.flags.bladeCase) { c.flags.bladeCase = true; drawCards(run, 1); }
  leaveMark(run, config, instance);
  run.log = `打出「${card.char}」：${damage ? `造成${damage}伤害，` : ''}格挡${c.block}，蓄势${c.charge}。`;
  return true;
}
export function releaseSkill(run, config) {
  if (run.phase !== 'battle' || !run.combat.skill) return false;
  const c = run.combat, card = config.recipes[c.skill.key];
  if (c.releases >= config.limits.releases || card.cost > c.energy || c.skill.expires < c.round) return false;
  c.energy -= card.cost; c.skill = null; c.releases++;
  const damage = effects(run, config, card);
  run.log = `释放「${card.name}」：${damage ? `${damage}伤害，` : ''}格挡${c.block}，灼痕${c.burn}。`;
  finishBattle(run, config); return true;
}
export function endRound(run, config) {
  if (run.phase !== 'battle') return false;
  const c = run.combat;
  c.marks = []; if (c.skill?.expires <= c.round) c.skill = null;
  c.enemyHp -= c.burn; c.burn = Math.max(0, c.burn - (c.burnDecay ? 0 : 1));
  if (finishBattle(run, config)) return true;
  const intent = enemyIntent(run), damage = Math.max(0, intent.attack - c.block);
  if (intent.base > 0 && intent.attack <= c.block && hasRelic(run, 'rubbing')) charge(run, config, 1);
  const remainingBlock = Math.max(0, c.block - intent.attack);
  run.hp = Math.max(0, run.hp - damage);
  run.log = intent.base ? `妖物攻击${intent.base}，受到${damage}伤害。` : '妖物准备下一轮攻势，抓紧布阵。';
  if (!run.hp) { run.phase = 'lost'; c.skill = null; return true; }
  const retained = c.hand.filter(id => cardInfo(config, run.deck.find(card => card.id === id)).retain);
  c.discard.push(...c.hand.filter(id => !retained.includes(id))); c.hand = retained;
  c.round++; c.energy = config.energy; c.block = Math.min(remainingBlock, c.retainBlock); c.retainBlock = 0; c.weaken = 0;
  c.armor = c.enemy.armors?.[(c.round - 1) % c.enemy.attacks.length] || 0;
  c.stamped = []; c.fusions = 0; c.releases = 0; delete c.flags.cinnabar;
  drawCards(run, config.handSize); return true;
}
export function advance(run, config) {
  run.event = null; run.phase = 'route'; run.rewards = []; run.relicChoices = []; run.craftChoices = [];
  run.routes = shuffle(run, config.routeSchedule[run.floor]);
}
export function takeReward(run, config, key = null) {
  if (run.phase !== 'reward' || (key !== null && !run.rewards.includes(key))) return false;
  if (key) run.deck.push({ id: run.nextId++, key, upgraded: false });
  if (run.combat.elite && !run.eliteRelic) { run.eliteRelic = true; openRelics(run, config); }
  else advance(run, config);
  return true;
}
export function takeRelic(run, config, key) {
  if (run.phase !== 'relic' || !run.relicChoices.includes(key) || run.relics.includes(key)) return false;
  run.relics.push(key); advance(run, config); return true;
}
export function rest(run, config, id = null) {
  if (run.phase !== 'rest') return false;
  if (id !== null) {
    const card = run.deck.find(c => c.id === id); if (!card || card.upgraded) return false;
    card.upgraded = true;
  } else run.hp = Math.min(run.maxHp, run.hp + config.restHeal);
  advance(run, config); return true;
}
export function editDeck(run, config, type, arg) {
  if (run.phase !== 'rest') return false;
  if (type === 'remove') {
    const index = run.deck.findIndex(c => c.id === arg);
    if (index < 0 || run.deck.length <= config.limits.minimumDeck) return false;
    run.deck.splice(index, 1);
  } else return false;
  advance(run, config); return true;
}
// v1与v2使用冻结规则；v3校验内容版本并重放奇遇、笔迹与全部合法操作。
export function restore(config, save, legacyConfig, previousConfig) {
  if (save?.version === 2) return previousConfig ? previousRestore(previousConfig, save, legacyConfig) : null;
  if (save?.version === 1) {
    if (!legacyConfig) return null;
    const run = legacyRestore(legacyConfig, save);
    return run ? { ...run, rulesVersion: 1 } : null;
  }
  if (save?.version !== 3 || save.contentVersion !== config.contentVersion || save.mode !== 'tower' || !Number.isInteger(save.seed) || save.seed < 0 || save.seed > 4294967295 || !Array.isArray(save.actions) || save.actions.length > 10000) return null;
  const starterId = save.starterId ?? 'beginner';
  if (typeof starterId !== 'string' || !Object.hasOwn(config.presets, starterId)) return null;
  const run = createRun(config, save.seed, starterId);
  for (const action of save.actions) if (!applyAction(run, config, action)) return null;
  return run;
}
export function applyAction(run, config, action, legacyConfig, previousConfig) {
  if (!Array.isArray(action) || action.length !== 2 || typeof action[0] !== 'string') return false;
  if (run.rulesVersion === 1) return legacyConfig ? legacyAction(run, legacyConfig, action) : false;
  if (run.rulesVersion === 2) return previousConfig ? previousAction(run, previousConfig, action, legacyConfig) : false;
  const [type, arg] = action;
  if (type === 'eventLeave') { if (run.phase !== 'eventResult' || arg !== null) return false; advance(run, config); return true; }
  if (type.startsWith('event')) return eventAction(run, config, type, arg);
  if (type === 'route') return chooseRoute(run, config, arg);
  if (type === 'play') return play(run, config, arg);
  if (type === 'end') return endRound(run, config);
  if (type === 'reward') return takeReward(run, config, arg);
  if (type === 'relic') return takeRelic(run, config, arg);
  if (type === 'rest') return rest(run, config, arg);
  if (type === 'craft' || type === 'remove') return editDeck(run, config, type, arg);
  if (type === 'fuse') return fuse(run, config, arg);
  if (type === 'release') return releaseSkill(run, config);
  if (type === 'abandon') return abandonSkill(run);
  return false;
}
