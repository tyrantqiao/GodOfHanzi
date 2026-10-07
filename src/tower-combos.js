// 字印只来自普通实体卡，衍生术式与普通牌堆完全分离。
export function recipeIngredients(config, key) {
  const recipe = config.recipes[key];
  return [...(recipe.from ? recipeIngredients(config, recipe.from) : []), ...recipe.materials];
}
export function missingIngredients(config, deck, key) {
  const counts = {};
  for (const card of deck) counts[card.key] = (counts[card.key] || 0) + 1;
  return recipeIngredients(config, key).filter(material => {
    if (counts[material]) { counts[material]--; return false; }
    return true;
  });
}
export function leaveMark(run, config, instance) {
  const c = run.combat;
  if (c.stamped.includes(instance.id)) return;
  c.stamped.push(instance.id);
  c.marks.push({ id: c.nextMark++, cardId: instance.id, key: instance.key, flameTier: config.cards[instance.key].flameTier || 0 });
  if (c.marks.length > config.limits.marks) c.marks.shift();
}
function materialsMatch(recipe, marks) {
  if (marks.length !== recipe.materials.length || new Set(marks.map(m => m.id)).size !== marks.length) return false;
  const expected = [...recipe.materials].sort(), actual = marks.map(m => m.key).sort();
  if (!expected.every((key, i) => key === actual[i])) return false;
  return !recipe.differentFlameTiers || (!marks.some(m => !m.flameTier) && new Set(marks.map(m => m.flameTier)).size === marks.length);
}
export function availableCombos(run, config) {
  if (run.phase !== 'battle' || ![2, 3].includes(run.rulesVersion) || run.combat.fusions >= config.limits.fusions) return [];
  const c = run.combat, result = [];
  for (const [key, recipe] of Object.entries(config.recipes)) {
    if (recipe.from && c.skill?.key !== recipe.from) continue;
    const selected = [], used = new Set();
    for (const material of recipe.materials) {
      const mark = c.marks.find(m => m.key === material && !used.has(m.id));
      if (!mark) break;
      selected.push(mark); used.add(mark.id);
    }
    if (materialsMatch(recipe, selected)) result.push({ key, markIds: selected.map(m => m.id), replacing: Boolean(c.skill && !recipe.from) });
  }
  return result;
}
export function fuse(run, config, arg) {
  if (run.phase !== 'battle' || ![2, 3].includes(run.rulesVersion) || !arg || typeof arg !== 'object') return false;
  if (typeof arg.key !== 'string' || !Object.hasOwn(config.recipes, arg.key)) return false;
  const c = run.combat, recipe = config.recipes[arg.key];
  if (!recipe || c.fusions >= config.limits.fusions || !Array.isArray(arg.markIds)) return false;
  if (recipe.from && c.skill?.key !== recipe.from) return false;
  if (!recipe.from && c.skill && arg.replace !== true) return false;
  const marks = arg.markIds.map(id => c.marks.find(m => m.id === id));
  if (marks.some(m => !m) || !materialsMatch(recipe, marks)) return false;
  const expires = recipe.from ? c.skill.expires : c.round + 1;
  c.marks = c.marks.filter(m => !arg.markIds.includes(m.id));
  c.skill = { key: arg.key, expires }; c.fusions++;
  if (!run.discovered.includes(arg.key)) run.discovered.push(arg.key);
  run.log = `字印凝成「${recipe.name}」，可立即释放或保留至第${expires}回合结束。`;
  return true;
}
export function abandonSkill(run) {
  if (run.phase !== 'battle' || !run.combat.skill) return false;
  run.combat.skill = null; run.log = '散去术式，重新凝字。'; return true;
}

