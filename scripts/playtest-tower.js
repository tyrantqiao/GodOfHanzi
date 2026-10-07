import { glyphStrokes } from '../src/tower-craft.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRun, applyAction, restore, cardInfo, enemyIntent } from '../src/tower-core.js';
import { availableCombos } from '../src/tower-combos.js';
const config = {...JSON.parse(fs.readFileSync(new URL('../data/tower.json', import.meta.url))), ...JSON.parse(fs.readFileSync(new URL('../data/tower-events.json', import.meta.url)))};
const preferences = {
  burn: ['fire','flame','ember','ash','draw','hold','heavy','guide','exchange'],
  guard: ['quake','hold','rock','stop','steady','draw','gather','guide'],
  charge: ['gather','break','hide','rock','heavy','draw','guide','steady'],
  spiral: ['qi','spin','wind','water','draw','hold','guide','exchange'],
};
function cardValue(key, style, run) {
  const order = preferences[style], position = order.indexOf(key);
  let score = position < 0 ? 0 : 12-position;
  const count = run.deck.filter(c=>c.key===key).length;
  if(count>=2) score-=8;
  return score;
}
function playScore(run, instance) {
  const card = cardInfo(config,instance), c=run.combat;
  let damage=(card.damage||0)*(card.hits||1)+(card.detonate?c.burn*2:0)+(card.chargeDamage?c.charge*card.chargeDamage:0)+(card.blockDamage?c.block:0);
  if(damage-c.armor>=c.enemyHp) return 1000;
  const needed=Math.max(0,enemyIntent(run).attack-c.block), block=(card.block||0)+(card.burningBlock&&c.burn?card.burningBlock:0)+(card.heavyBlock&&enemyIntent(run).base>=12?card.heavyBlock:0)+(card.weaken||0);
  let score=damage+Math.min(needed,block)*(run.hp<25?2.2:1.5)+(card.burn||0)*2+(card.charge||0)*2+(card.draw||0)*(c.energy>1?3:1)+(card.burnDecay&&!c.burnDecay?4:0);
  if(card.scry)score+=2;if(card.exchange)score+=2;if(card.retainBlock)score+=2;
  if(card.blockDamage&&needed>c.block/2)score-=4;
  if(!c.stamped.includes(instance.id)&&Object.values(config.recipes).some(r=>r.materials.includes(instance.key)&&r.materials.some(k=>c.marks.some(m=>m.key===k))))score+=3;
  return score/Math.max(1,card.cost);
}
export function simulate(seed, style='burn', includeSave=false) {
  const starterId='beginner';
  const run=createRun(config,seed,starterId), actions=[], rounds=[], combos=new Set();
  const doAction=(type,arg=null)=>{assert.equal(applyAction(run,config,[type,arg]),true,`${seed} ${type}`);actions.push([type,arg]);};
  for(let step=0;step<2000&&!['won','lost'].includes(run.phase);step++) {
    if(run.phase==='route') {
      const choice=run.routes.includes('rest')&&run.hp<25?'rest':run.routes.includes('event')?'event':run.routes.includes('battle')?'battle':run.routes[0];doAction('route',choice);continue;
    }
    if(run.phase.startsWith('event')) {
      const state=run.event,event=config.events.find(e=>e.id===state.id),rank=keys=>[...keys].sort((a,b)=>cardValue(b,style,run)-cardValue(a,style,run))[0];
      if(run.phase==='eventResult')doAction('eventLeave');
      else if(run.phase==='eventReward')doAction('eventReward',rank(state.choices));
      else if(run.phase==='eventCraft'){const key=rank(state.choices);doAction('eventCraft',seed%2?{key,mode:'hand',strokes:glyphStrokes[key]}:{key,mode:'assist'});}
      else if(run.phase==='eventRemove')doAction('eventRemove',run.deck.length>config.limits.minimumDeck?run.deck.find(c=>c.key==='shield')?.id??null:null);
      else if(event.kind==='quiz'){if(state.answered)doAction('eventNext');else doAction('eventAnswer',seed%4===0?0:event.questions[state.step].correct);}
      else{const choices=event.choices.map((choice,i)=>({i,effect:choice.effect})).filter(x=>x.effect.type!=='risk'||run.hp>x.effect.cost+15);choices.sort((a,b)=>{
        const value=x=>x.type==='heal'?(run.hp<25?30:0):x.type==='remove'?1:Math.max(...(x.keys||[]).map(key=>cardValue(key,style,run)))+(x.type==='craft'?2:x.type==='risk'?1:0);
        return value(b.effect)-value(a.effect);});doAction('eventChoice',choices[0].i);}
      continue;
    }
    if(run.phase==='reward') {
      const ranked=[...run.rewards].sort((a,b)=>cardValue(b,style,run)-cardValue(a,style,run));doAction('reward',cardValue(ranked[0],style,run)>0?ranked[0]:null);continue;
    }
    if(run.phase==='relic') {doAction('relic',run.relicChoices[0]);continue;}
    if(run.phase==='rest') {
      if(run.maxHp-run.hp>=config.restHeal)doAction('rest');
      else doAction('rest',run.deck.find(c=>!c.upgraded)?.id??null);
      continue;
    }
    const c=run.combat, options=availableCombos(run,config).filter(o=>!o.replacing);
    const option=options.find(o=>config.recipes[o.key].from)||options[0];
    if(option){doAction('fuse',{key:option.key,markIds:option.markIds});combos.add(option.key);continue;}
    if(c.skill&&c.releases<config.limits.releases&&config.recipes[c.skill.key].cost<=c.energy){
      const canUpgrade=Object.values(config.recipes).some(r=>r.from===c.skill.key&&r.materials.every(key=>c.hand.some(id=>{const card=run.deck.find(x=>x.id===id);return card.key===key&&cardInfo(config,card).cost<=c.energy;}))&&c.fusions<config.limits.fusions);
      if(!canUpgrade){doAction('release');continue;}
    }
    const candidates=c.hand.map(id=>run.deck.find(x=>x.id===id)).filter(x=>cardInfo(config,x).cost<=c.energy).sort((a,b)=>playScore(run,b)-playScore(run,a));
    if(candidates.length){
      const instance=candidates[0], card=cardInfo(config,instance), arg=card.scry?{id:instance.id,targets:c.draw.slice(0,1)}:card.exchange?{id:instance.id,targets:[]}:instance.id;
      doAction('play',arg);continue;
    }
    rounds.push({floor:run.floor,round:c.round});doAction('end');
    if(run.phase==='battle'){
      const ids=[...run.combat.hand,...run.combat.draw,...run.combat.discard,...run.combat.exhaust];
      assert.equal(ids.length,run.deck.length);assert.equal(new Set(ids).size,run.deck.length);assert.ok(run.combat.hand.length<=10);
    }
  }
  assert.ok(['won','lost'].includes(run.phase),'试炼必须结束');
  assert.deepEqual(restore(config,{version:3,contentVersion:config.contentVersion,starterId,mode:'tower',seed,actions}),run,'整局重放应完全一致');
  return {seed,style,result:run.phase,floor:run.floor,hp:run.hp,cards:run.deck.length,actions:actions.length,rounds:rounds.length,combos:[...combos],
    ...(includeSave ? {save:{version:3,contentVersion:config.contentVersion,starterId,mode:'tower',seed,actions}} : {})};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const rows=[];for(const style of Object.keys(preferences))for(let seed=1;seed<=12;seed++)rows.push(simulate(seed,style));
  for(const style of Object.keys(preferences)){const sample=rows.filter(r=>r.style===style);console.log(`${style}：${sample.filter(r=>r.result==='won').length}/12登顶，平均结束楼层${(sample.reduce((n,r)=>n+r.floor,0)/12).toFixed(1)}，发现${new Set(sample.flatMap(r=>r.combos)).size}类组合`);}
  console.log('48局均已结束，牌堆守恒、手牌上限与整局存档重放全部通过。');
}
