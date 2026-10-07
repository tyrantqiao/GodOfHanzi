import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  percent,
  gradeText,
  calculateDamage,
  skillAppliesState,
  skillConsumesState,
  normalizeBattleState,
  getBattleResult,
} from './battle.js';

test('clamp keeps value inside range', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(42, 0, 10), 10);
});

test('percent normalizes current over max and guards empty bars', () => {
  assert.equal(percent(50, 200), 25);
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(300, 100), 100); // clamped at ceiling
  assert.equal(percent(-10, 100), 0); // clamped at floor
});

test('gradeText maps known grades and falls back for custom ones', () => {
  assert.equal(gradeText({ grade: 9, realm: '开窍境' }), '九品 · 开窍境');
  assert.equal(gradeText({ grade: 7, realm: '通文境' }), '七品 · 通文境');
  assert.equal(gradeText({ grade: 12, realm: '圣境' }), '12品 · 圣境');
});

test('calculateDamage adds attack and base power, subtracts defense', () => {
  assert.equal(calculateDamage({ attack: 32 }, { basePower: 46 }, 6), 72);
  assert.equal(calculateDamage({ attack: 32 }, { basePower: 46 }), 78); // defense defaults to 0
});

test('calculateDamage never drops below 1', () => {
  assert.equal(calculateDamage({ attack: 1 }, { basePower: 1 }, 999), 1);
});

test('火留下灼痕，刀消耗灼痕打出连招伤害', () => {
  const fire = { basePower: 22, appliesState: '灼痕', applyThreshold: .25 };
  const blade = { basePower: 46, consumesState: '灼痕', comboMultiplier: 1.6 };
  const actor = { attack: 32 };
  assert.equal(skillAppliesState(fire, .24), false);
  assert.equal(skillAppliesState(fire, .25), true);
  assert.equal(skillConsumesState(blade, []), false);
  assert.equal(skillConsumesState(blade, ['灼痕']), true);
  assert.equal(calculateDamage(actor, blade, 6, []), 72);
  assert.equal(calculateDamage(actor, blade, 6, ['灼痕']), 115);
  assert.equal(calculateDamage(actor, fire, 6, ['灼痕']), 48);
});

test('normalizeBattleState strips legacy action bars and seeds the turn', () => {
  const state = {
    party: [{ id: 'shen_yan', action: 5, hp: 320 }],
    enemy: { id: 'frost_vine', action: 9, hp: 180 },
  };
  const result = normalizeBattleState(state);
  assert.equal(result, state);
  assert.equal('action' in state.party[0], false);
  assert.equal('action' in state.enemy, false);
  assert.deepEqual(state.turn, { side: 'player', round: 1, skipEnemy: false, targetId: null });
});

test('normalizeBattleState preserves an existing turn object', () => {
  const state = {
    party: [],
    enemy: {},
    turn: { side: 'enemy', round: 7, skipEnemy: true, targetId: 'lu_qingya' },
  };
  normalizeBattleState(state);
  assert.equal(state.turn.round, 7);
  assert.equal(state.turn.side, 'enemy');
});

test('getBattleResult reports win, lose and ongoing', () => {
  assert.equal(getBattleResult({ enemy: { hp: 0 }, party: [{ hp: 10 }] }), 'win');
  assert.equal(getBattleResult({ enemy: { hp: 5 }, party: [{ hp: 0 }, { hp: 0 }] }), 'lose');
  assert.equal(getBattleResult({ enemy: { hp: 5 }, party: [{ hp: 0 }, { hp: 3 }] }), 'ongoing');
});
