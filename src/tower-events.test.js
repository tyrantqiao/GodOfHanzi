import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,applyAction,restore,chooseRoute,play} from './tower-core.js';
import {createRun as oldRun,applyAction as oldAction} from './tower-core-v2.js';
import {glyphStrokes,scoreCraft} from './tower-craft.js';
import {openEvent} from './tower-events.js';
import {availableCombos} from './tower-combos.js';
const config={...JSON.parse(readFileSync(new URL('../data/tower.json',import.meta.url))),...JSON.parse(readFileSync(new URL('../data/tower-events.json',import.meta.url)))};
const previous=JSON.parse(readFileSync(new URL('../data/tower-v2.json',import.meta.url)));
const legacy=JSON.parse(readFileSync(new URL('../data/tower-v1.json',import.meta.url)));
const saved=(seed,actions)=>({version:3,contentVersion:config.contentVersion,mode:'tower',starterId:'beginner',seed,actions});
function scene(id){const c={...config,events:[config.events.find(e=>e.id===id)]},run=createRun(c,12);applyAction(run,c,['route','event']);return {c,run};}
function act(run,c,type,arg=null){assert.equal(applyAction(run,c,[type,arg]),true,type);}
function reject(run,c,type,arg=null){const before=structuredClone(run);assert.equal(applyAction(run,c,[type,arg]),false);assert.deepEqual(run,before);}
test('所有新局仅有刀盾十张且无开局遗物，取消解锁高级预设',()=>{
 const run=createRun(config,1);assert.deepEqual(run.deck.map(c=>c.key),[...Array(5).fill('blade'),...Array(5).fill('shield')]);assert.deepEqual(run.relics,[]);assert.deepEqual(run.routes,['event']);assert.equal(Object.keys(config.presets).length,1);assert.throws(()=>createRun(config,1,'spiral'));
});
test('首遇李白，论诗三种选择通向选卡、选卡和亲笔制卡',()=>{
 for(let i=0;i<3;i++){const {run,c}=scene('libai');act(run,c,'eventChoice',i);assert.equal(run.phase,i===2?'eventCraft':'eventReward');assert.equal(run.deck.length,10);}
});
test('30个奇遇定义唯一，所有卡面与字谱存在；历史人物名单无近现代人物',()=>{
 assert.equal(config.events.length,30);assert.equal(new Set(config.events.map(e=>e.id)).size,30);
 const people=new Set(['李白','杜甫','苏轼','李清照','陶渊明','王维','岳飞','项羽','屈原','文天祥','嵇康','荆轲']);
 for(const e of config.events){assert.ok(readFileSync(new URL('../'+e.art,import.meta.url)).length);if(['dialogue','lament'].includes(e.kind))assert.ok(people.has(e.person));if(e.kind==='cameo')assert.match(e.person,/小说彩蛋/);for(const choice of e.choices){for(const key of choice.effect.keys||[]){assert.ok(config.cards[key]);if(choice.effect.type==='craft')assert.ok(glyphStrokes[key]);}}for(const key of e.rewardKeys||[])assert.ok(config.cards[key]);}
});
test('奇遇选项验证与奖励结算只发生一次，跳过奖励仍能离开',()=>{
 const {run,c}=scene('libai');reject(run,c,'eventChoice',-1);reject(run,c,'eventChoice','0');reject(run,c,'eventReward','qi');act(run,c,'eventChoice',0);reject(run,c,'eventChoice',0);reject(run,c,'eventReward','break');act(run,c,'eventReward','wind');assert.equal(run.deck.length,11);reject(run,c,'eventReward','wind');reject(run,c,'eventLeave','伪造');act(run,c,'eventLeave');assert.equal(run.floor,1);assert.deepEqual(run.routes,['battle']);assert.equal(run.event,null);
 const other=scene('libai');act(other.run,other.c,'eventChoice',0);act(other.run,other.c,'eventReward');assert.equal(other.run.deck.length,10);act(other.run,other.c,'eventLeave');
});
test('诗词答题保留逐题解析，禁止重复答题与越过未答题目',()=>{
 const {run,c}=scene('poetry');reject(run,c,'eventNext');reject(run,c,'eventAnswer',3);act(run,c,'eventAnswer',0);assert.match(run.event.feedback,/李白/);reject(run,c,'eventAnswer',0);act(run,c,'eventNext');act(run,c,'eventAnswer',0);act(run,c,'eventNext');assert.equal(run.phase,'eventReward');assert.equal(run.event.upgraded,true);act(run,c,'eventReward','fire');assert.equal(run.deck.at(-1).upgraded,true);
});
test('答题部分正确得普通卡，全错回复4生命且不会卡关',()=>{
 for(const answers of [[0,1],[1,1]]){const {run,c}=scene('poetry');run.hp=40;for(const answer of answers){act(run,c,'eventAnswer',answer);act(run,c,'eventNext');}if(answers[0]===0){assert.equal(run.phase,'eventReward');assert.equal(run.event.upgraded,false);}else{assert.equal(run.phase,'eventResult');assert.equal(run.hp,44);act(run,c,'eventLeave');}}
});
test('每条原创挽词均有馈赠，亲笔选择没有道德评分',()=>{
 for(const e of config.events.filter(e=>e.kind==='lament'))for(let i=0;i<e.choices.length;i++){const {run,c}=scene(e.id);act(run,c,'eventChoice',i);assert.ok(['eventReward','eventCraft'].includes(run.phase));}
});
test('冒险代价事先固定，不能扣成零生命，安全分支仍给普通卡',()=>{
 const {run,c}=scene('furnace');run.hp=8;reject(run,c,'eventChoice',0);act(run,c,'eventChoice',1);assert.equal(run.event.upgraded,false);
 const next=scene('furnace');act(next.run,next.c,'eventChoice',0);assert.equal(next.run.hp,52);assert.equal(next.run.event.upgraded,true);act(next.run,next.c,'eventReward','flame');assert.equal(next.run.deck.at(-1).upgraded,true);
});
test('亲笔笔迹达标获得强化卡并保存笔迹；辅助仅普通卡，不能伪造升级',()=>{
 for(const mode of ['hand','assist']){const {run,c}=scene('brush');act(run,c,'eventChoice',0);const arg=mode==='hand'?{key:'fire',mode,strokes:glyphStrokes.fire}:{key:'fire',mode};act(run,c,'eventCraft',arg);assert.equal(run.deck.at(-1).upgraded,mode==='hand');assert.equal(Boolean(run.deck.at(-1).ink),mode==='hand');reject(run,c,'eventCraft',arg);}
 const {run,c}=scene('brush');act(run,c,'eventChoice',0);reject(run,c,'eventCraft',{key:'flame',mode:'assist'});reject(run,c,'eventCraft',{key:'fire',mode:'hand',strokes:[]});reject(run,c,'eventCraft',{key:'fire',mode:'assist',strokes:glyphStrokes.fire});
});
test('书写判定拒绝空白、单点、越界、非有限与超限笔迹，漫墨不能强化',()=>{
 for(const strokes of [[],[[[20,20]]],[[[20,20],[Infinity,20]]],[[[20,20],[-1,30]]],Array(33).fill([[20,20],[30,30]])])assert.equal(scoreCraft('fire',strokes),null);
 const scribble=Array.from({length:20},(_,i)=>[[0,i*5],[100,i*5]]);assert.equal(scoreCraft('fire',scribble).upgraded,false);assert.equal(scoreCraft('fire',glyphStrokes.fire).upgraded,true);assert.equal(scoreCraft('unknown',glyphStrokes.fire),null);
});
test('奇遇删牌遵守八张下限且可保留原册，回血不溢出生命上限',()=>{
 const {run,c}=scene('tao');act(run,c,'eventChoice',0);run.deck.length=8;reject(run,c,'eventRemove',run.deck[0].id);act(run,c,'eventRemove');assert.equal(run.deck.length,8);
 const next=scene('sushi');next.run.hp=59;act(next.run,next.c,'eventChoice',2);assert.equal(next.run.hp,60);
});
test('同种子奇遇不重复，流程和问答、亲笔、结果中间状态可合法重放',()=>{
 const seed=77,run=createRun(config,seed),actions=[];
 const doIt=(type,arg=null)=>{act(run,config,type,arg);actions.push([type,arg]);assert.deepEqual(restore(config,saved(seed,actions)),run);};
 doIt('route','event');doIt('eventChoice',2);doIt('eventCraft',{key:'fire',mode:'hand',strokes:glyphStrokes.fire});doIt('eventLeave');
 const sequence=createRun(config,31);for(let i=0;i<config.events.length;i++)openEvent(sequence,config);assert.equal(new Set(sequence.seenEvents).size,config.events.length);
 for(const id of ['poetry','furnace']){const {run,c}=scene(id),localActions=[['route','event']];const replay=(type,arg=null)=>{act(run,c,type,arg);localActions.push([type,arg]);assert.deepEqual(restore(c,saved(12,localActions)),run);};if(id==='poetry'){replay('eventAnswer',0);replay('eventNext');replay('eventAnswer',1);replay('eventNext');replay('eventReward','qi');}else{replay('eventChoice',0);replay('eventReward','flame');}replay('eventLeave');}
});
test('v2与v1存档按原规则继续，当前新规则拒绝非法版本及奖励操作',()=>{
 const seed=2,actions=[['route','battle'],['end',null]],run=oldRun(previous,seed,'spiral');for(const a of actions)oldAction(run,previous,a);
 const record={version:2,contentVersion:previous.contentVersion,starterId:'spiral',mode:'tower',seed,actions};assert.deepEqual(restore(config,record,legacy,previous),run);const restored=restore(config,record,legacy,previous);assert.equal(applyAction(restored,config,['end',null],legacy,previous),true);
 assert.equal(restore(config,record,legacy),null);assert.equal(restore(config,{...saved(1,[]),contentVersion:'tower-2.0'}),null);assert.equal(restore(config,saved(1,[['eventReward','fire']])),null);
});
test('新版仍支持组合凝式，新手盾与山岳字卡分别定义',()=>{
 const run=createRun(config,1);run.routes=['battle'];chooseRoute(run,config,'battle');run.deck.push({id:11,key:'qi'},{id:12,key:'spin'});Object.assign(run.combat,{hand:[11,12],draw:[],energy:10,enemyHp:200});play(run,config,11);play(run,config,12);const option=availableCombos(run,config).find(c=>c.key==='orb');assert.ok(option);act(run,config,'fuse',{key:'orb',markIds:option.markIds});assert.equal(run.combat.skill.key,'orb');assert.equal(config.cards.shield.char,'盾');assert.equal(config.cards.guard.char,'山');
});

test('普通与精英战后只提供普通刀盾，笔斋不再直接生成强力卡',()=>{
 for(const elite of [false,true]){const run=createRun(config,1);run.routes=[elite?'elite':'battle'];chooseRoute(run,config,run.routes[0]);run.combat.enemyHp=1;run.combat.armor=0;run.combat.hand=[1];play(run,config,1);assert.deepEqual(run.rewards,['blade','shield']);assert.equal(run.deck.length,10);act(run,config,'reward','shield');assert.equal(run.deck.at(-1).upgraded,false);}
 const run=createRun(config,1);run.routes=['rest'];chooseRoute(run,config,'rest');reject(run,config,'craft','fire');assert.deepEqual(run.craftChoices,[]);
});

test('全部强力卡与术式组件都有奇遇获取来源',()=>{
 const available=new Set([...config.starter,...config.events.flatMap(event=>[...(event.rewardKeys||[]),...event.choices.flatMap(choice=>choice.effect.keys||[])])]);
 for(const key of Object.keys(config.cards))assert.ok(available.has(key),key);
 for(const recipe of Object.values(config.recipes))for(const key of recipe.materials)assert.ok(available.has(key),key);
});
