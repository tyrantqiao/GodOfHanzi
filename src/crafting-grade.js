// 教学护持只帮助成卡，不替换玩家的笔迹，也不假称自动识别书法。
export function gradeCraft(score, mark, style = 'regular') {
  if (!mark || mark.pixels < 160 || mark.span < 48) return { accepted: false, message: '先写下一段有笔势的墨迹。长者会护持成卡；空白或单点不能成卡。' };
  if (score.tier === 'flooded') return { accepted: false, message: '墨已漫纸，先收住笔势。重写无需消耗材料。' };
  if (style === 'running' && score.coverage >= .5 && score.precision >= .7) {
    return { accepted: true, quality: '逸品', star: 2, style: '行草', support: '笔势试炼' };
  }
  return { accepted: true, quality: '完美', star: 1, style: style === 'running' ? '行草' : '楷书', support: '长者护持' };
}
