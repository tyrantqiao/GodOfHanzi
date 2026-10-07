import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, cardInfo, chooseRoute, play, endRound, takeReward, takeRelic, rest, restore, applyAction, editDeck, drawCards, releaseSkill, enemyIntent, advance } from './tower-core-v2.js';
import { createRun as legacyRun, applyAction as legacyAction } from './tower-core-v1.js';
import { availableCombos, fuse } from './tower-combos.js';
const config = JSON.parse(readFileSync(new URL('../data/tower-v2.json', import.meta.url)));
const legacy = JSON.parse(readFileSync(new URL('../data/tower-v1.json', import.meta.url)));
function save(seed, actions) { return {version:2, contentVersion:config.contentVersion, mode:'tower', seed, actions}; }
function battle(keys, relics = []) {
  const run = createRun(config, 42); run.relics = relics;
  run.deck = keys.map((key, i) => ({id:i+1,key,upgraded:false})); run.nextId = keys.length + 1;
  assert.equal(chooseRoute(run,config,'battle'),true);
  Object.assign(run.combat, {enemyHp:200, armor:0, energy:20, hand:run.deck.map(c=>c.id), draw:[], discard:[], block:0});
  run.combat.enemy.attacks = [10,10,10]; run.combat.enemy.armors = [0,0,0];
  return run;
}
function combine(run, key) {
  const choice = availableCombos(run,config).find(c=>c.key===key); assert.ok(choice, key);
  return fuse(run,config,{key,markIds:choice.markIds,replace:choice.replacing});
}

test('新规则同种子路线、奖励、遗物与牌序可重放，拒绝非法与版本不符存档', () => {
  const seed=42, actions=[['route','battle'],['end',null]], run=createRun(config,seed);
  for(const action of actions) assert.equal(applyAction(run,config,action),true);
  assert.deepEqual(restore(config,save(seed,actions)),run);
  for(const actions of [[['play',999]],[['fuse',{key:'__proto__',markIds:[]}]], [['release',null]], [['end']]]) assert.equal(restore(config,save(seed,actions)),null);
  assert.equal(restore(config,{...save(seed,[]),contentVersion:'未知'}),null);
  assert.equal(restore(config,{...save(seed,[]),seed:-1}),null);
});

test('旧版六卡存档按冻结规则恢复并可继续，新卡池不改变旧奖励', () => {
  const seed=17, actions=[['route','battle'],['end',null]], expected=legacyRun(legacy,seed);
  for(const action of actions) legacyAction(expected,legacy,action);
  const restored=restore(config,{version:1,mode:'tower',seed,actions},legacy);
  assert.deepEqual(restored,{...expected,rulesVersion:1});
  assert.equal(applyAction(restored,config,['end',null],legacy),true);
  legacyAction(expected,legacy,['end',null]); assert.deepEqual(restored,{...expected,rulesVersion:1});
  assert.equal(restore(config,{version:1,mode:'tower',seed,actions}),null);
});

test('新手十张预设、22张卡、17配方与6遗物均有可读取卡面', () => {
  assert.deepEqual(createRun(config,1).deck.map(c=>c.key),legacy.starter);
  assert.equal(Object.keys(config.cards).length,22); assert.equal(Object.keys(config.recipes).length,17);
  for(const item of [...Object.values(config.cards),...Object.values(config.recipes),...Object.values(config.relics),...config.enemies,...config.bosses]) {
    assert.ok(readFileSync(new URL('../'+item.art,import.meta.url)).length>0,item.name);
  }
  for(const card of Object.values(config.cards)) assert.ok(config.cardTypes[card.type]);
});

test('普通格挡抵伤后清空，生命跨层保留，奖励可跳过', () => {
  const run=battle(['guard','blade']); play(run,config,1); assert.equal(run.combat.block,7);
  endRound(run,config); assert.equal(run.hp,57); assert.equal(run.combat.block,0);
  run.combat.enemyHp=1; run.combat.hand=[2]; play(run,config,2); assert.equal(run.phase,'reward');
  takeReward(run,config); assert.equal(run.hp,57); assert.equal(run.deck.length,2);
});

test('火刀引爆、灼痕击杀先于反击、失败不再出牌', () => {
  const run=battle(['fire','blade']); play(run,config,1); play(run,config,2);
  assert.equal(run.combat.enemyHp,185); assert.equal(run.combat.burn,0);
  run.combat.enemyHp=2; run.combat.burn=2; const hp=run.hp;
  endRound(run,config); assert.equal(run.phase,'reward'); assert.equal(run.hp,hp);
  const lost=battle(['blade']); lost.hp=1; endRound(lost,config);
  assert.equal(lost.phase,'lost'); assert.equal(play(lost,config,1),false);
});

test('精英强化奖励后首次赠遗物，重复精英不重复赠，塔顶击杀获胜', () => {
  const run=createRun(config,3);run.relics=[];run.routes=['elite'];chooseRoute(run,config,'elite');
  Object.assign(run.combat,{enemyHp:1,armor:0,hand:[1]});play(run,config,1);
  takeReward(run,config,run.rewards[0]);assert.equal(run.deck.at(-1).upgraded,true);assert.equal(run.phase,'relic');
  assert.equal(takeRelic(run,config,run.relicChoices[0]),true);assert.equal(run.phase,'route');
  run.routes=['elite'];chooseRoute(run,config,'elite');Object.assign(run.combat,{enemyHp:1,armor:0,hand:[1]});play(run,config,1);takeReward(run,config);
  assert.equal(run.phase,'route');assert.equal(run.relics.length,1);
  run.floor=8;run.routes=['boss'];chooseRoute(run,config,'boss');Object.assign(run.combat,{enemyHp:1,armor:0,hand:[1]});play(run,config,1);assert.equal(run.phase,'won');
});

test('路线保证宝阁、笔斋与首领，未开放路线不消耗楼层', () => {
  const run=createRun(config,3);assert.equal(chooseRoute(run,config,'rest'),false);assert.equal(run.floor,0);
  run.floor=3;advance(run,config);assert.deepEqual(run.routes,['treasure']);chooseRoute(run,config,'treasure');assert.equal(run.phase,'relic');
  const key=run.relicChoices[0];takeRelic(run,config,key);assert.equal(takeRelic(run,config,key),false);
  run.floor=7;advance(run,config);assert.ok(run.routes.includes('rest'));run.floor=8;advance(run,config);assert.deepEqual(run.routes,['boss']);
});

test('笔斋回血、强化、删牌、临摹补牌互斥且限制最小牌组', () => {
  for(const operation of ['rest','upgrade','remove','craft']) {
    const run=createRun(config,3);run.routes=['rest'];chooseRoute(run,config,'rest');run.hp=20;
    const done=operation==='rest'?rest(run,config):operation==='upgrade'?rest(run,config,1):editDeck(run,config,operation,operation==='craft'?run.craftChoices[0]:1);
    assert.equal(done,true);assert.equal(run.phase,'route');assert.equal(rest(run,config),false);
    if(operation==='rest') assert.equal(run.hp,38);
    if(operation==='upgrade') assert.equal(run.deck[0].upgraded,true);
    if(operation==='remove') assert.equal(run.deck.length,9);
    if(operation==='craft') assert.equal(run.deck.length,11);
  }
  const run=createRun(config,3);run.deck=run.deck.slice(0,8);run.routes=['rest'];chooseRoute(run,config,'rest');
  assert.equal(editDeck(run,config,'remove',1),false);assert.equal(run.phase,'rest');
});

test('奖励排除基础刀山，候选互异且只提供可用卡', () => {
  for(let seed=1;seed<=12;seed++) {
    const run=createRun(config,seed);chooseRoute(run,config,'battle');Object.assign(run.combat,{enemyHp:1,armor:0,hand:[1]});play(run,config,1);
    assert.equal(new Set(run.rewards).size,3);assert.ok(run.rewards.every(k=>config.rewardPool.includes(k)));
  }
});

test('蓄势跨回合保留、上限9，破消耗全部资源，战斗后重置', () => {
  const run=battle(['gather','rock','break']);play(run,config,1);play(run,config,2);assert.equal(run.combat.charge,5);
  endRound(run,config);assert.equal(run.combat.charge,5);run.combat.hand=[3];play(run,config,3);
  assert.equal(run.combat.enemyHp,173);assert.equal(run.combat.charge,0);
  run.combat.charge=8;run.combat.hand=[1];play(run,config,1);assert.equal(run.combat.charge,9);
  run.combat.enemyHp=1;run.combat.hand=[3];run.combat.energy=3;assert.equal(play(run,config,3),true);takeReward(run,config);run.routes=['battle'];chooseRoute(run,config,'battle');assert.equal(run.combat.charge,0);
});

test('守势只保留反击后剩余格挡，震消耗向上取整的一半', () => {
  const run=battle(['guard','hold','quake']);play(run,config,1);play(run,config,2);assert.equal(run.combat.block,12);
  play(run,config,3);assert.equal(run.combat.enemyHp,188);assert.equal(run.combat.block,6);
  run.combat.block=21;endRound(run,config);assert.equal(run.combat.block,8);assert.equal(run.combat.retainBlock,0);
  endRound(run,config);assert.equal(run.combat.block,0);
});

test('保留牌跨回合仍计手牌上限，消耗牌不洗回，余烬不能反向增加灼痕', () => {
  const run=battle(['hide','ember','blade']);play(run,config,2);assert.deepEqual(run.combat.exhaust,[2]);run.combat.burn=3;
  endRound(run,config);assert.ok(run.combat.hand.includes(1));assert.ok(!run.combat.hand.includes(2));assert.equal(run.combat.burn,3);
  const ids=[...run.combat.hand,...run.combat.draw,...run.combat.discard,...run.combat.exhaust];assert.equal(new Set(ids).size,3);assert.equal(ids.length,3);
});

test('引的置顶选择不合法时无副作用，换允许零弃牌并验证重复目标', () => {
  const run=battle(['guide','exchange','blade','guard']);run.combat.hand=[1,2];run.combat.draw=[3,4];
  const before=structuredClone(run);assert.equal(play(run,config,{id:1,targets:[999]}),false);assert.deepEqual(run,before);
  assert.equal(play(run,config,{id:1,targets:[4]}),true);assert.deepEqual(run.combat.draw,[4,3]);assert.ok(run.combat.exhaust.includes(1));
  const beforeExchange=structuredClone(run);assert.equal(play(run,config,{id:2,targets:[2,2]}),false);assert.deepEqual(run,beforeExchange);
  assert.equal(play(run,config,{id:2,targets:[]}),true);assert.ok(run.combat.hand.includes(4));
});

test('多次攻击分别消耗护甲，灼痕绕过护甲，蓄力轮不反击', () => {
  const run=battle(['spin']);run.combat.armor=4;play(run,config,1);assert.equal(run.combat.enemyHp,198);assert.equal(run.combat.armor,0);
  run.combat.armor=9;run.combat.burn=3;run.combat.enemy.attacks=[0,20];const hp=run.hp;endRound(run,config);
  assert.equal(run.hp,hp);assert.equal(run.combat.enemyHp,195);assert.equal(enemyIntent(run).base,20);
});

test('朱砂砚每回合首触发、余烬灯每战首触发，完全格挡正攻击增加蓄势', () => {
  const run=battle(['fire','fire','blade'],['cinnabar','emberLamp','rubbing']);play(run,config,1);play(run,config,2);assert.equal(run.combat.burn,5);
  play(run,config,3);assert.equal(run.combat.burn,2);run.combat.block=10;endRound(run,config);assert.equal(run.combat.charge,1);
  run.combat.hand=[1,3];run.combat.energy=3;play(run,config,1);assert.equal(run.combat.burn,4);play(run,config,3);assert.equal(run.combat.burn,0);
});

test('旧书签每战额外抽一次，藏锋匣触发一次且不突破手牌上限', () => {
  const run=battle(['heavy','blade','guard'],['bookmark','bladeCase']);run.combat.hand=[1];run.combat.draw=[2];run.combat.discard=[3];
  play(run,config,1);assert.ok(run.combat.hand.includes(2));assert.equal(run.combat.flags.bladeCase,true);
  drawCards(run,1);assert.equal(run.combat.flags.bookmark,true);assert.equal(run.combat.hand.length,3);
});

test('组合材料互斥，重复字必须两张实体牌，字印限3且不能重放留印', () => {
  const run=battle(['fire','fire','guard','blade']);play(run,config,1);
  assert.ok(!availableCombos(run,config).some(c=>c.key==='twin'));
  play(run,config,2);assert.ok(combine(run,'twin'));assert.equal(run.combat.marks.length,0);
  run.combat.hand.push(1);play(run,config,1);assert.equal(run.combat.marks.length,0);
  const crowded=battle(['fire','guard','blade','draw']);for(let id=1;id<=4;id++) play(crowded,config,id);
  assert.deepEqual(crowded.combat.marks.map(m=>m.key),['guard','blade','draw']);
});

test('异层火焰融合消耗部分灼痕，不额外复制火刀收益', () => {
  const run=battle(['fire','flame','blade']);play(run,config,1);play(run,config,2);assert.ok(combine(run,'lotus'));
  assert.equal(run.combat.burn,6);assert.equal(releaseSkill(run,config),true);
  assert.equal(run.combat.enemyHp,188);assert.equal(run.combat.burn,2);assert.equal(run.combat.skill,null);
  play(run,config,3);assert.equal(run.combat.enemyHp,177);assert.equal(run.combat.burn,0);
  const bad=structuredClone(config);bad.cards.flame.flameTier=1;const other=battle(['fire','flame']);play(other,bad,1);play(other,bad,2);assert.ok(!availableCombos(other,bad).some(c=>c.key==='lotus'));
});

test('气旋进阶替换旧技能、继承期限、每回合限2次凝式与1次释放', () => {
  const run=battle(['qi','spin','wind','fire']);play(run,config,1);play(run,config,2);combine(run,'orb');
  assert.equal(run.combat.skill.expires,2);play(run,config,3);combine(run,'windBlade');
  assert.equal(run.combat.skill.key,'windBlade');assert.equal(run.combat.skill.expires,2);
  play(run,config,4);assert.equal(availableCombos(run,config).length,0);
  const hp=run.combat.enemyHp;releaseSkill(run,config);assert.equal(run.combat.enemyHp,hp-9);assert.equal(releaseSkill(run,config),false);
  assert.equal(run.combat.releases,1);assert.equal(run.combat.marks.length,1);
});

test('术式保留一次，跨回合进阶不续期，三级释放不足费用不消耗', () => {
  const run=battle(['qi','spin','wind','fire']);play(run,config,1);play(run,config,2);combine(run,'orb');
  endRound(run,config);assert.equal(run.combat.skill.key,'orb');assert.equal(run.combat.marks.length,0);
  run.combat.hand=[3,4];play(run,config,3);combine(run,'windBlade');play(run,config,4);combine(run,'flameWheel');
  assert.equal(run.combat.skill.expires,2);run.combat.energy=0;const before=structuredClone(run);
  assert.equal(releaseSkill(run,config),false);assert.deepEqual(run,before);endRound(run,config);assert.equal(run.combat.skill,null);
});

test('替换已有术式必须显式确认，伪造材料与重复材料拒绝且无副作用', () => {
  const run=battle(['qi','spin','fire','guard']);play(run,config,1);play(run,config,2);combine(run,'orb');play(run,config,3);play(run,config,4);
  const option=availableCombos(run,config).find(c=>c.key==='lava'), before=structuredClone(run);
  assert.equal(fuse(run,config,{key:'lava',markIds:option.markIds}),false);assert.deepEqual(run,before);
  assert.equal(fuse(run,config,{key:'lava',markIds:[option.markIds[0],option.markIds[0]],replace:true}),false);assert.deepEqual(run,before);
  assert.equal(fuse(run,config,{key:'lava',markIds:option.markIds,replace:true}),true);assert.equal(run.combat.skill.key,'lava');
});

test('普通卡击杀立即结束，不留下可利用字印或术式；保留效果取最大值', () => {
  const run=battle(['guard','stop','blade','hold']);play(run,config,1);play(run,config,2);combine(run,'seal');releaseSkill(run,config);play(run,config,4);
  assert.equal(run.combat.retainBlock,8);run.combat.enemyHp=1;play(run,config,3);assert.equal(run.phase,'reward');assert.equal(run.combat.skill,null);assert.deepEqual(run.combat.marks,[]);
});

test('真实起始牌组组合操作可保存、重放恢复未释放术式', () => {
  let recorded;
  for(let seed=1;seed<100 && !recorded;seed++) {
    const run=createRun(config,seed), actions=[['route','battle']];applyAction(run,config,actions[0]);
    const fire=run.deck.find(c=>c.key==='fire'&&run.combat.hand.includes(c.id)), guard=run.deck.find(c=>c.key==='guard'&&run.combat.hand.includes(c.id));
    if(!fire||!guard) continue;
    for(const id of [fire.id,guard.id]) {const a=['play',id];assert.equal(applyAction(run,config,a),true);actions.push(a);}
    if(run.phase!=='battle')continue;
    const option=availableCombos(run,config).find(c=>c.key==='lava');const a=['fuse',{key:option.key,markIds:option.markIds}];assert.equal(applyAction(run,config,a),true);actions.push(a);
    const replayed=restore(config,save(seed,actions));assert.deepEqual(replayed,run);assert.equal(replayed.combat.skill.key,'lava');recorded=true;
  }
  assert.equal(recorded,true);
});

test('四套预设保持十张合法卡、相同生命文气，保存后恢复正确起始牌组', () => {
  for (const starterId of Object.keys(config.presets)) {
    const seed=23, run=createRun(config,seed,starterId), actions=[['route','battle']];
    assert.equal(run.deck.length,10); assert.equal(run.hp,config.maxHp); assert.ok(run.deck.every(card=>config.cards[card.key]));
    applyAction(run,config,actions[0]); assert.equal(run.combat.energy,config.energy);
    assert.deepEqual(restore(config,{...save(seed,actions),starterId}),run);
  }
  assert.equal(restore(config,{...save(23,[]),starterId:'不存在的预设'}),null);
});
test('气旋预设能够直接提供一阶与进阶材料，配方前置图无循环', () => {
  const run=createRun(config,1,'spiral');assert.ok(['qi','spin','wind'].every(key=>run.deck.some(c=>c.key===key)));
  for(const key of Object.keys(config.recipes)) {
    const seen=new Set();let current=key;
    while(current){assert.ok(!seen.has(current));seen.add(current);assert.ok(Object.hasOwn(config.recipes,current));current=config.recipes[current].from;}
  }
});
