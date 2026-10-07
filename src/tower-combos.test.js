import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, chooseRoute, play, endRound } from './tower-core-v2.js';
import { availableCombos, fuse, missingIngredients } from './tower-combos.js';
const config = JSON.parse(readFileSync(new URL('../data/tower-v2.json', import.meta.url)));
function scene() {
  const run = createRun(config, 1); run.relics = []; chooseRoute(run, config, 'battle');
  Object.assign(run.combat, { hand: [5, 9], draw: [], discard: [], enemyHp: 100, armor: 0 });
  play(run, config, 5); play(run, config, 9); return run;
}
test('查询组合候选没有副作用，材料跨回合失效后拒绝旧候选', () => {
  const run = scene(), before = structuredClone(run), option = availableCombos(run, config).find(c => c.key === 'lava');
  assert.ok(option); assert.deepEqual(run, before);
  endRound(run, config); const next = structuredClone(run);
  assert.equal(fuse(run, config, {key: option.key, markIds: option.markIds}), false); assert.deepEqual(run, next);
});
test('同一份材料不能重复凝式，不能伪造术式进阶', () => {
  const run = scene(), option = availableCombos(run, config).find(c => c.key === 'lava');
  const action = {key: option.key, markIds: option.markIds};
  assert.equal(fuse(run, config, action), true); const before = structuredClone(run);
  assert.equal(fuse(run, config, {...action, replace: true}), false);
  assert.equal(fuse(run, config, {key: 'windBlade', markIds: []}), false); assert.deepEqual(run, before);
});
test('恶意或不完整材料操作一律无副作用', () => {
  const run = scene(), before = structuredClone(run);
  for (const arg of [null, [], {key:'constructor',markIds:[]}, {key:'lava',markIds:'错误'}, {key:'lava',markIds:[null,{}]}, {key:'lava',markIds:[1,1]}]) {
    assert.equal(fuse(run, config, arg), false); assert.deepEqual(run, before);
  }
});
test('奖励组合提示识别重复组件数量与多段进阶前置', () => {
  assert.deepEqual(missingIngredients(config,[{key:'fire'}],'twin'),['fire']);
  assert.deepEqual(missingIngredients(config,[{key:'qi'},{key:'spin'}],'windBlade'),['wind']);
  assert.deepEqual(missingIngredients(config,[{key:'qi'},{key:'spin'},{key:'wind'}],'flameWheel'),['fire']);
});
