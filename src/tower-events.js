import { shuffle } from './card-tutorial-core.js';
import { scoreCraft } from './tower-craft.js';
export function openEvent(run,config){
 const pool=config.events.filter(e=>!run.seenEvents.includes(e.id));
 const candidates=pool.length?pool:config.events; const event=run.seenEvents.length===0?config.events[0]:shuffle(run,candidates)[0];
 run.seenEvents.push(event.id);run.event={id:event.id,step:0,correct:0,answered:false,feedback:'',choices:[],upgraded:false};run.phase='event';run.log=event.scene;
}
function result(run,message){run.phase='eventResult';run.event.feedback=message;run.log=message;}
function cards(run,effect){run.event.choices=[...effect.keys];run.event.upgraded=Boolean(effect.upgraded);run.phase='eventReward';}
export function eventAction(run,config,type,arg){
 const state=run.event,event=config.events.find(e=>e.id===state?.id);
 if(!event)return false;
 if(type==='eventChoice'){
  if(run.phase!=='event'||event.kind==='quiz'||!Number.isInteger(arg)||arg<0||arg>=event.choices.length)return false;
  const choice=event.choices[arg],effect=choice.effect;
  if(effect.type==='risk'&&run.hp<=effect.cost)return false;
  state.feedback=choice.reply;
  if(effect.type==='cards')cards(run,effect);
  else if(effect.type==='risk'){run.hp-=effect.cost;cards(run,{...effect,upgraded:true});}
  else if(effect.type==='craft'){state.choices=[...effect.keys];run.phase='eventCraft';}
  else if(effect.type==='heal'){const before=run.hp;run.hp=Math.min(run.maxHp,run.hp+effect.amount);result(run,`${choice.reply} 回复${run.hp-before}生命。`);}
  else if(effect.type==='remove')run.phase='eventRemove';
  else return false;
  return true;
 }
 if(type==='eventAnswer'){
  const q=event.questions?.[state.step];
  if(run.phase!=='event'||!q||state.answered||!Number.isInteger(arg)||arg<0||arg>=q.answers.length)return false;
  state.answered=true;state.correct+=Number(arg===q.correct);state.feedback=`${arg===q.correct?'答对了！':'这题未答对。'} ${q.explanation}`;return true;
 }
 if(type==='eventNext'){
  if(run.phase!=='event'||event.kind!=='quiz'||!state.answered)return false;
  if(state.step+1<event.questions.length){state.step++;state.answered=false;state.feedback='';}
  else if(state.correct){cards(run,{keys:event.rewardKeys,upgraded:state.correct===event.questions.length});state.feedback=`答对${state.correct}/${event.questions.length}题，${state.upgraded?'获得强化字卡':'获得普通字卡'}。`;}
  else{const before=run.hp;run.hp=Math.min(run.maxHp,run.hp+4);result(run,`两题未答对，已看过解析。回复${run.hp-before}生命，下次再试。`);}
  return true;
 }
 if(type==='eventReward'){
  if(run.phase!=='eventReward'||(arg!==null&&!state.choices.includes(arg)))return false;
  if(arg!==null)run.deck.push({id:run.nextId++,key:arg,upgraded:state.upgraded});
  result(run,arg===null?'你保留精简的牌册，向同行者道别。':`「${config.cards[arg].char}」${state.upgraded?'强化卡':''}已入册。${state.feedback}`);return true;
 }
 if(type==='eventCraft'){
  if(run.phase!=='eventCraft'||!arg||!state.choices.includes(arg.key)||!['hand','assist'].includes(arg.mode))return false;
  const score=arg.mode==='hand'?scoreCraft(arg.key,arg.strokes):null;
  if(arg.mode==='hand'&&!score)return false;
  if(arg.mode==='assist'&&arg.strokes!==undefined)return false;
  const instance={id:run.nextId++,key:arg.key,upgraded:score?.upgraded||false};
  if(score)instance.ink=structuredClone(arg.strokes);
  run.deck.push(instance);result(run,score?`亲笔「${config.cards[arg.key].char}」已入册，覆盖${Math.round(score.coverage*100)}%，准确${Math.round(score.precision*100)}%。${score.upgraded?'笔势达标，获得强化卡！':'获得普通卡，继续修行。'}`:`稳笔辅助完成「${config.cards[arg.key].char}」，获得普通卡。`);return true;
 }
 if(type==='eventRemove'){
  if(run.phase!=='eventRemove'||(arg!==null&&(run.deck.length<=config.limits.minimumDeck||!run.deck.some(c=>c.id===arg))))return false;
  if(arg!==null)run.deck.splice(run.deck.findIndex(c=>c.id===arg),1);
  result(run,arg===null?'你收好牌册，保留了原本的笔意。':'你删去一张字卡，牌册更精简了。');return true;
 }
 return false;
}
