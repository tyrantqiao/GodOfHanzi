const writingScoreRules = {
  standard: Object.freeze({ perfectCoverage: .9, perfectPrecision: .9 }),
  tutorial: Object.freeze({ perfectCoverage: .5, perfectPrecision: .55 }),
};

export function getWritingScoreRules(difficulty = 'standard') {
  return writingScoreRules[difficulty] || writingScoreRules.standard;
}

export function scoreWriting(template, ink, rules = writingScoreRules.standard) {
  const perfectCoverage = rules.perfectCoverage ?? writingScoreRules.standard.perfectCoverage;
  const perfectPrecision = rules.perfectPrecision ?? writingScoreRules.standard.perfectPrecision;
  let target = 0, marked = 0, overlap = 0;
  for (let i = 3; i < template.length; i += 4) {
    const a = template[i] > 32, b = ink[i] > 32;
    if (a) target++;
    if (b) marked++;
    if (a && b) overlap++;
  }
  const coverage = target ? overlap / target : 0;
  const precision = marked ? overlap / marked : 0;
  const fill = marked / (template.length / 4);
  const flooded = fill >= .65 && precision < .55;
  const score = flooded ? 0 : coverage * precision;
  const perfect = coverage >= perfectCoverage && precision >= perfectPrecision;
  const tier = flooded ? 'flooded' : perfect ? 'perfect' : score < .2 ? 'weak' : score >= .65 ? 'good' : 'normal';
  return {
    coverage,
    precision,
    fill,
    score,
    tier,
    power: flooded ? 0 : perfect ? 1 : score,
    perfectCoverage,
    perfectPrecision,
  };
}
