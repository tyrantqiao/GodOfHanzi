// 制卡时钟与失笔判定保持无DOM，界面只负责显形。
export function createCraftSession() { return { deadline: null, failed: false, reason: '' }; }
export function remainingSeconds(session, now) { return session.deadline === null ? null : Math.max(0, Math.ceil((session.deadline - now) / 1000)); }
export function manifestation(score, mark) {
  if (mark.pixels < 160 || mark.span < 48) return 'quiet';
  if (score.coverage >= .5 && score.precision >= .7) return 'treasure';
  if (score.coverage >= .2 && score.precision >= .6) return 'gathering';
  return 'protected';
}
export function isRuinedStroke(before, after, added, matched, flooded) {
  return flooded || (before.coverage >= .2 && before.precision >= .6 && added >= 500 && matched / added < .25 && before.precision - after.precision >= .08);
}
