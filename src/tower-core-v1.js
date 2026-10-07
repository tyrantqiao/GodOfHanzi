import { shuffle } from './card-tutorial-core.js';

export function createRun(config, seed = Date.now() >>> 0) {
  return { floor: 0, phase: 'route', hp: config.maxHp, maxHp: config.maxHp, seed,
    deck: config.starter.map((key, i) => ({ id: i + 1, key, upgraded: false })), nextId: config.starter.length + 1,
    routes: ['battle', 'rest'], rewards: [], combat: null, log: '选择路线，开始登塔。' };
}
export function cardInfo(config, card) {
  const info = { ...config.cards[card.key] };
  if (card.upgraded) for (const key of ['damage', 'block']) if (info[key]) info[key] += config.upgradeBonus;
  return info;
}
export function drawCards(run, count) {
  const c = run.combat;
  while (count-- > 0 && c.hand.length < 10) {
    if (!c.draw.length) { c.draw = shuffle(run, c.discard); c.discard = []; }
    if (!c.draw.length) break;
    c.hand.push(c.draw.shift());
  }
}
export function chooseRoute(run, config, type) {
  if (run.phase !== 'route' || !run.routes.includes(type)) return false;
  run.floor++;
  if (type === 'rest') { run.phase = 'rest'; return true; }
  const base = type === 'boss' ? config.boss : shuffle(run, config.enemies)[0];
  const s = config.scaling, elite = type === 'elite';
  const enemy = { ...base, hp: base.hp + (type === 'boss' ? 0 : run.floor * s.hpPerFloor + (elite ? s.eliteHp : 0)),
    attacks: base.attacks.map(n => n + (type === 'boss' ? 0 : run.floor * s.attackPerFloor + (elite ? s.eliteAttack : 0))) };
  run.combat = { enemy, elite, enemyHp: enemy.hp, round: 1, energy: config.energy, block: 0, burn: 0, weaken: 0,
    hand: [], draw: shuffle(run, run.deck.map(c => c.id)), discard: [] };
  run.phase = 'battle'; run.log = '观察敌方意图，文气用尽后结束回合。'; drawCards(run, config.handSize); return true;
}
function finishBattle(run, config) {
  if (run.combat.enemyHp > 0) return;
  run.combat.enemyHp = 0;
  if (run.floor === config.floors) { run.phase = 'won'; run.log = '九层登顶，本次试炼完成。'; }
  else { run.phase = 'reward'; run.rewards = shuffle(run, Object.keys(config.cards)).slice(0, 3); run.log = '选择一张字卡入册，也可跳过。'; }
}
export function play(run, config, id) {
  const c = run.combat, instance = run.deck.find(card => card.id === id);
  if (run.phase !== 'battle' || !instance || !c.hand.includes(id)) return false;
  const card = cardInfo(config, instance); if (card.cost > c.energy) return false;
  c.energy -= card.cost; c.hand.splice(c.hand.indexOf(id), 1); c.discard.push(id);
  let damage = card.damage || 0;
  if (card.detonate && c.burn) { damage += c.burn * 2; c.burn = 0; }
  c.enemyHp -= damage; c.burn += card.burn || 0; c.block += card.block || 0; c.weaken += card.weaken || 0;
  if (card.draw) drawCards(run, card.draw);
  run.log = `打出「${card.char}」，造成${damage}伤害，当前格挡${c.block}。`;
  finishBattle(run, config); return true;
}
export function endRound(run, config) {
  if (run.phase !== 'battle') return false;
  const c = run.combat; c.enemyHp -= c.burn; c.burn = Math.max(0, c.burn - 1);
  finishBattle(run, config); if (run.phase !== 'battle') return true;
  const intent = c.enemy.attacks[(c.round - 1) % c.enemy.attacks.length];
  const damage = Math.max(0, intent - c.weaken - c.block); run.hp = Math.max(0, run.hp - damage);
  run.log = `妖物攻击${intent}，格挡与压制后受到${damage}伤害。`;
  if (!run.hp) { run.phase = 'lost'; return true; }
  c.discard.push(...c.hand); c.hand = []; c.round++; c.energy = config.energy; c.block = 0; c.weaken = 0;
  drawCards(run, config.handSize); return true;
}
export function advance(run, config) {
  run.phase = 'route'; run.rewards = [];
  run.routes = run.floor === config.floors - 1 ? ['boss'] : run.floor === config.floors - 2 ? ['rest', 'battle'] : shuffle(run, ['battle', 'elite', 'rest']).slice(0, 2);
}
export function takeReward(run, config, key = null) {
  if (run.phase !== 'reward' || (key !== null && !run.rewards.includes(key))) return false;
  if (key) run.deck.push({ id: run.nextId++, key, upgraded: run.combat.elite });
  advance(run, config); return true;
}
export function rest(run, config, id = null) {
  if (run.phase !== 'rest') return false;
  if (id !== null) {
    const card = run.deck.find(c => c.id === id); if (!card || card.upgraded || !['damage', 'block'].some(k => config.cards[card.key][k])) return false;
    card.upgraded = true;
  } else run.hp = Math.min(run.maxHp, run.hp + config.restHeal);
  advance(run, config); return true;
}
// 以种子和操作记录重放，避免信任存档内的战斗状态与数值。
export function restore(config, save) {
  if (save?.version !== 1 || save.mode !== 'tower' || !Number.isInteger(save.seed) || save.seed < 0 || save.seed > 4294967295 || !Array.isArray(save.actions) || save.actions.length > 10000) return null;
  const run = createRun(config, save.seed);
  for (const action of save.actions) if (!applyAction(run, config, action)) return null;
  return run;
}
export function applyAction(run, config, action) {
  if (!Array.isArray(action)) return false;
  const [type, arg] = action;
  if (type === 'route') return chooseRoute(run, config, arg);
  if (type === 'play') return play(run, config, arg);
  if (type === 'end') return endRound(run, config);
  if (type === 'reward') return takeReward(run, config, arg);
  if (type === 'rest') return rest(run, config, arg);
  return false;
}
