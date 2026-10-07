// Pure combat math and battle-state helpers, free of DOM/browser globals.
// Extracted so the core rules can be unit-tested with `node --test`.

export const gradeLabels = {
  1: "一品",
  2: "二品",
  3: "三品",
  4: "四品",
  5: "五品",
  6: "六品",
  7: "七品",
  8: "八品",
  9: "九品",
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function percent(current, max) {
  if (!max) return 0;
  return clamp((current / max) * 100, 0, 100);
}

export function gradeText(entity) {
  return `${gradeLabels[entity.grade] || `${entity.grade}品`} · ${entity.realm}`;
}

export function skillConsumesState(skill, enemyStates = []) {
  return Boolean(skill.consumesState && enemyStates.includes(skill.consumesState));
}

export function skillAppliesState(skill, power) {
  return Boolean(skill.appliesState && power >= (skill.applyThreshold ?? 1));
}

export function calculateDamage(actor, skill, enemyDefense = 0, enemyStates = []) {
  const rawDamage = skill.basePower + actor.attack - enemyDefense;
  const multiplier = skillConsumesState(skill, enemyStates) ? (skill.comboMultiplier ?? 1) : 1;
  return Math.max(1, Math.round(rawDamage * multiplier));
}

// Legacy saves may still carry an "action" bar; strip it and make sure a turn
// object exists so the battle loop can run. Mutates and returns the state.
export function normalizeBattleState(state) {
  for (const entity of [...state.party, state.enemy]) delete entity.action;
  state.turn ||= { side: "player", round: 1, skipEnemy: false, targetId: null };
  return state;
}

export function getBattleResult(state) {
  if (state.enemy.hp <= 0) return "win";
  if (state.party.every((member) => member.hp <= 0)) return "lose";
  return "ongoing";
}
