import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRun, activeDeck, isVineBound, definition, acceptGift, playCard, endTurn, resolveEnemy, craftCard, nextBattle, validSave } from './card-tutorial-core.js';
import { gradeCraft } from './crafting-grade.js';
const config=JSON.parse(readFileSync(new URL('../data/tutorial-cards.json',import.meta.url)));
const png='data:image/png;base64,cGVuLWlua3M=';
const normal={accepted:true,quality:'完美',star:1,style:'楷书',support:'长者护持'};
const save=run=>({version:4,mode:'card-tutorial',run});
function useGifts(){const r=makeRun(config);acceptGift(r);playCard(r,config,'card-1');playCard(r,config,'card-2');return r;}
function craftBoth(r,grade=normal){for(const recipe of config.recipes)assert.ok(craftCard(r,config,recipe.id,grade,png));return r;}

test('v5草稿保留到期时间、废纸锁定和已用道具，兼容v4',()=>{
  const r=useGifts();
  r.craftDraft={recipeId:'ownFire',style:'regular',assisted:true,inkImage:png,session:{deadline:Date.now()+45000,failed:true,reason:'墨路已断',aidUsed:true}};
  const s={version:5,mode:'card-tutorial',run:r};
  assert.equal(validSave(s,config),true);
  const restored=JSON.parse(JSON.stringify(s)); assert.deepEqual(restored.run.craftDraft.session,r.craftDraft.session);
  restored.run.craftDraft.session.deadline='无限';assert.equal(validSave(restored,config),false);
  assert.equal(validSave(save(useGifts()),config),true);
});
test('开场受困，接卡不解缚，施法后解除且读档不重新缠绕',()=>{
  const r=makeRun(config); assert.equal(isVineBound(r),true);
  acceptGift(r); assert.equal(isVineBound(r),true);
  assert.ok(playCard(r,config,'card-1')); assert.equal(isVineBound(r),false);
  const restored=JSON.parse(JSON.stringify(save(r))); assert.ok(validSave(restored,config)); assert.equal(isVineBound(restored.run),false);
  playCard(r,config,'card-2'); assert.equal(r.combat.enemyHp,0);
  craftBoth(r); nextBattle(r,config); assert.equal(isVineBound(r),false);
});

test('长者赠两张亲笔三星卡，先接卡再先火后刀，出牌不触发反击',()=>{
 const r=makeRun(config);assert.equal(r.stage,'gift');assert.equal(r.deck.length,2);assert.ok(r.deck.every(card=>card.owner==='mentor'&&card.star===3));
 assert.equal(playCard(r,config,'card-1'),false);assert.equal(acceptGift(r),true);assert.equal(acceptGift(r),false);
 assert.equal(playCard(r,config,'card-2'),false);assert.equal(endTurn(r,config),false);
 assert.equal(playCard(r,config,'card-1'),true);assert.equal(r.hp,60);assert.equal(r.combat.enemyHp,12);assert.equal(r.combat.energy,2);
 assert.equal(playCard(r,config,'card-1'),false);assert.equal(playCard(r,config,'card-2'),true);assert.equal(r.stage,'craft');assert.equal(r.combat.enemyHp,0);
 assert.deepEqual(r.spent,['card-1','card-2']);assert.equal(activeDeck(r).length,0);assert.equal(resolveEnemy(r,config),false);assert.equal(validSave(save(r),config),true);
});
test('固定两步制卡，只扣一次材料，第一张和第二张都保存原笔迹',()=>{
 const r=useGifts();assert.equal(craftCard(r,config,'ownBlade',normal,png),false);assert.equal(nextBattle(r,config),false);
 const fire=craftCard(r,config,'ownFire',normal,png);assert.ok(fire);assert.equal(fire.inkImage,png);assert.equal(fire.quality,'完美');assert.equal(r.stage,'craft');assert.equal(r.materials.thin,0);
 assert.equal(craftCard(r,config,'ownFire',normal,png),false);assert.equal(craftCard(r,config,'ownBlade',normal,''),false);assert.equal(nextBattle(r,config),false);
 assert.equal(validSave(save(r),config),true);const blade=craftCard(r,config,'ownBlade',normal,png);assert.ok(blade);assert.equal(blade.inkImage,png);assert.equal(r.stage,'crafted');assert.equal(r.craftedIds.length,2);assert.equal(validSave(save(r),config),true);
 assert.equal(nextBattle(r,config),true);assert.deepEqual(r.combat.hand,['card-3','card-4']);assert.equal(r.combat.exhaust.length,0);assert.ok(r.combat.hand.every(id=>!r.spent.includes(id)));
});
test('亲制卡重复抽回，长者赠卡永久燃尽，保留未打出的卡',()=>{
 const r=craftBoth(useGifts());nextBattle(r,config);playCard(r,config,'card-3');playCard(r,config,'card-4');assert.equal(r.combat.enemyHp,15);assert.equal(r.hp,60);
 assert.equal(r.combat.discard.length,2);assert.equal(r.spent.length,2);endTurn(r,config);assert.equal(endTurn(r,config),false);
 const copy=structuredClone(r);resolveEnemy(r,config);resolveEnemy(copy,config);assert.deepEqual(copy,r);assert.equal(r.hp,54);assert.equal(r.combat.hand.length,2);assert.equal(r.combat.energy,3);
 const kept=r.combat.hand[0];endTurn(r,config);assert.ok(r.combat.hand.includes(kept));resolveEnemy(r,config);assert.equal(r.combat.hand.length,2);assert.equal(validSave(save(r),config),true);
});
test('长者支持让低匹配笔迹完美，但空白、单点、漫墨不能成卡',()=>{
 const score={coverage:.02,precision:.1,tier:'weak'};
 assert.equal(gradeCraft(score,{pixels:0,span:0}).accepted,false);assert.equal(gradeCraft(score,{pixels:200,span:14}).accepted,false);
 const grade=gradeCraft(score,{pixels:1500,span:120});assert.equal(grade.quality,'完美');assert.equal(grade.star,1);
 assert.equal(gradeCraft({...score,tier:'flooded'},{pixels:120000,span:399}).accepted,false);
});
test('选择行草不会自动升阶，达到对应笔势阈值才制成二星逸品',()=>{
 const mark={pixels:3500,span:230};assert.equal(gradeCraft({coverage:.3,precision:.5,tier:'weak'},mark,'running').star,1);
 const grade=gradeCraft({coverage:.5,precision:.7,tier:'normal'},mark,'running');assert.equal(grade.star,2);assert.equal(grade.quality,'逸品');assert.equal(gradeCraft({coverage:1,precision:1,tier:'perfect'},mark,'regular').star,1);
 const r=craftBoth(useGifts(),grade);assert.equal(definition(r,config,'card-3').damage,6);assert.equal(definition(r,config,'card-3').burn,3);assert.equal(definition(r,config,'card-4').damage,10);
 assert.equal(validSave(save(r),config),true);
});
test('制一张卡后的存档、未完成笔迹与待反击阶段完整恢复，两种等级均可通关',()=>{
 for(const grade of [normal,{accepted:true,quality:'逸品',star:2,style:'行草',support:'笔势试炼'}]){
   let r=useGifts();craftCard(r,config,'ownFire',grade,png);r.craftDraft={recipeId:'ownBlade',style:'running',assisted:false,inkImage:png};assert.equal(validSave(save(r),config),true);
   r=JSON.parse(JSON.stringify(r));assert.equal(r.deck[2].inkImage,png);assert.equal(r.craftDraft.inkImage,png);craftCard(r,config,'ownBlade',grade,png);nextBattle(r,config);
   for(let step=0;step<30&&r.stage!=='complete';step++){
     assert.equal(validSave(save(r),config),true);r=JSON.parse(JSON.stringify(r));
     if(r.combat.phase==='enemy'){resolveEnemy(r,config);continue;}
     const id=r.combat.hand.includes('card-3')?'card-3':r.combat.hand[0];if(id)playCard(r,config,id);else endTurn(r,config);
   }
   assert.equal(r.stage,'complete');assert.ok(r.hp>0);assert.equal(validSave(save(r),config),true);
 }
});
test('存档拒绝旧版本、重复卡、伪造等级和返还长者赠卡',()=>{
 const r=craftBoth(useGifts());nextBattle(r,config);assert.equal(validSave({version:3,mode:'card-tutorial',run:r},config),false);
 for(const change of [s=>s.run.combat.hand.push('card-3'),s=>s.run.deck[2].star=7,s=>s.run.combat.hand[0]='card-1',s=>s.run.craftedIds.pop(),s=>s.run.deck[2].inkImage='javascript:alert(1)']){const s=structuredClone(save(r));change(s);assert.equal(validSave(s,config),false);}
});
