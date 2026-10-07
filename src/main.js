import { loadLocalSave, loadServerSave, saveLocal, saveServer } from "./storage.js";
import { getWritingScoreRules, scoreWriting } from './writing-score.js';
import { speak, stopVoice } from './voice.js';
import { playCue } from './sfx.js';
import { clamp, percent, gradeText, calculateDamage, skillAppliesState, skillConsumesState, normalizeBattleState, getBattleResult } from './battle.js';

const fallbackSkills = [
  {
    id: "dao",
    char: "火",
    title: "火字破霜",
    shortName: "火字破霜",
    text: "写火点燃霜藤，笔力达到25%便留下灼痕；接「刀」可引爆焰刃。",
    tags: ["引燃", "连招起手", "克霜"],
    preview: "引燃目标",
    action: "确认书写",
    spiritCost: 5,
    basePower: 22,
    target: "enemy",
    effect: "damage",
    appliesState: "灼痕",
    applyThreshold: 0.25,
    requiresWriting: true,
    previewVisible: true,
  },
  {
    id: "zhan",
    char: "刀",
    title: "焰刃斩藤",
    shortName: "焰刃斩藤",
    text: "以字化刀斩断霜藤；若目标带有灼痕，消耗灼痕并造成1.6倍伤害。",
    tags: ["爆发", "火刀连招", "克藤"],
    preview: "焰刃预览",
    action: "确认书写",
    spiritCost: 8,
    basePower: 46,
    target: "enemy",
    effect: "damage",
    consumesState: "灼痕",
    comboMultiplier: 1.6,
    requiresWriting: true,
    previewVisible: true,
  },
  {
    id: "jing",
    char: "生",
    title: "生息回春",
    shortName: "生息回春",
    text: "写生恢复生命；笔力达到50%还能驱散寒蚀、恐惧，并压下妖物狂暴。",
    tags: ["救场", "回血", "净化"],
    preview: "回春目标",
    action: "确认书写",
    spiritCost: 6,
    basePower: 36,
    target: "ally",
    effect: "cleanse",
    requiresWriting: true,
    previewVisible: false,
  },
  {
    id: "ding",
    char: "止",
    title: "止妖一息",
    shortName: "止妖一息",
    text: "写止封住妖势；笔力达到50%，霜藤妖便跳过下一次反击，为连招争取一笔。",
    tags: ["停手", "控场", "争取一笔"],
    preview: "定身目标",
    action: "确认书写",
    spiritCost: 7,
    basePower: 28,
    target: "enemy",
    effect: "control",
    requiresWriting: true,
    previewVisible: true,
  },
];

const cards = document.querySelectorAll(".skill-card");
const characterCards = document.querySelectorAll(".status-card");
const chapter = document.querySelector(".chapter");
const objective = document.querySelector(".objective");
const infoTitle = document.querySelector(".info-title");
const infoText = document.querySelector(".info-text");
const infoTags = document.querySelector(".info-tags");
const castButton = document.querySelector(".cast-button");
const saveButton = document.querySelector(".save-button");
const loadButton = document.querySelector(".load-button");
const saveStatus = document.querySelector(".save-status");
const combatLog = document.querySelector(".combat-log");
const enemyPanel = document.querySelector(".enemy-panel");
const mentorBubble = document.querySelector(".mentor-bubble");
const mentorLine = mentorBubble?.querySelector("p");
const mentorTipTrigger = document.querySelector('.mentor-tip-trigger');
const writingGuide = document.querySelector(".writing-guide");
const writingInkGlow = {
  dao: '#a15c43',
  zhan: '#657568',
  jing: '#83dca2',
  ding: '#7fd7ce',
};

let skillData = {};
let battleState = null;
let selectedSkill = "dao";
let selectedCharacter = "shen_yan";
let infoMode = "skill";
let initialBattle;
let battleEnded = false;
let writingPending = null;
let lastTick = performance.now();
let enemyDelay = 0;
const restButton = document.querySelector('#rest-button');
const writingDialog = document.querySelector('#writing-dialog');
const menuDialog = document.querySelector('#menu-dialog');
const resultDialog = document.querySelector('#result-dialog');
const openingSequence = document.querySelector('#opening-sequence');
const openingLine = document.querySelector('#opening-line');
const openingDetail = document.querySelector('#opening-detail');
const battleOmen = document.querySelector('.battle-omen');
let openingActive = false;
let openingTimers = [];
let omenTimer = null;
let resultTimer = null;
let mentorTipTimer = null;
let lastMentorTip = { message: mentorLine?.textContent || '先选一枚汉字，再凝神书写。', tone: 'guide' };

const mentorSkillTips = {
  dao: "先写「火」点燃霜藤；留下灼痕后，再写「刀」就能打出焰刃连击。",
  zhan: "霜藤带灼痕时写「刀」，可引爆火势，伤害变为1.6倍。也可让师父接这一刀。",
  jing: "「生」能救场：回血之外，笔力过半可洗去寒蚀，还能压下狂暴。",
  ding: "「止」能截断反击，为火接刀的连招争取下一笔。笔力达到50%即可。",
};

const writingGuides = {
  dao: "写「火」先顺着四处淡墨落笔；不必贪快，火星成形就能点燃霜藤。",
  zhan: "写「刀」时先顾字形，再顾速度。目标有灼痕，这一刀便会引爆火势。",
  jing: "写「生」要让横竖站稳。贴合淡墨、空处留白，生机才会回到身上。",
  ding: "写「止」要收住笔势。威力过半即可定身，覆盖和准确越高越稳。",
};

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return response.json();
  } catch {
    return fallback;
  }
}

function normalizeSkills(skills) {
  return Object.fromEntries(skills.map((skill) => [skill.id, skill]));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setSaveStatus(message) {
  saveStatus.textContent = `存档：${message}`;
}

function setLog(message) {
  combatLog.textContent = `战斗记录：${message}`;
}

function hideMentorTip() {
  if (!mentorBubble) return;
  clearTimeout(mentorTipTimer);
  mentorBubble.hidden = true;
  mentorTipTrigger?.setAttribute('aria-expanded', 'false');
  if (mentorBubble.contains(document.activeElement)) mentorTipTrigger?.focus();
}

function setMentorTip(message, tone = 'guide', appendVoice = false, voiceText = message) {
  if (!mentorBubble || !mentorLine) return;
  lastMentorTip = { message, tone };
  mentorLine.textContent = message;
  mentorBubble.hidden = false;
  mentorTipTrigger?.setAttribute('aria-expanded', 'true');
  if (voiceText) speak(voiceText, 'mentor', { interrupt: !appendVoice, deduplicate: true });
  mentorBubble.classList.remove('guide', 'praise', 'warn');
  mentorBubble.classList.add(tone);
  mentorBubble.style.animation = 'none';
  void mentorBubble.offsetWidth;
  mentorBubble.style.animation = '';
  clearTimeout(mentorTipTimer);
  mentorTipTimer = setTimeout(hideMentorTip, Math.min(8500, Math.max(4500, 2200 + message.length * 65)));
}

mentorTipTrigger?.addEventListener('click', () => {
  if (mentorBubble.hidden) setMentorTip(lastMentorTip.message, lastMentorTip.tone, false, '');
  else hideMentorTip();
});
mentorBubble?.querySelector('.mentor-tip-close')?.addEventListener('click', hideMentorTip);

function setWritingGuide(skill) {
  if (!writingGuide) return;
  const rules = getWritingScoreRules(battleState?.writingDifficulty);
  const coverage = Math.round(rules.perfectCoverage * 100);
  const precision = Math.round(rules.perfectPrecision * 100);
  const tutorialHint = battleState?.writingDifficulty === 'tutorial' ? '本关师父借你文气，' : '';
  writingGuide.textContent = `${writingGuides[skill.id] || '沿淡墨字形下笔，尽量覆盖该覆盖的笔画，避开空白处。'} ${tutorialHint}覆盖率达到${coverage}%、准确率达到${precision}%，就会触发完美术法。`;
}

function getActor(id = selectedCharacter) {
  return battleState.party.find((member) => member.id === id) || battleState.party[0];
}

function renderBar(container, current, max) {
  const fill = container.querySelector("span");
  const label = container.querySelector("strong");
  fill.style.width = `${percent(current, max)}%`;
  label.textContent = `${Math.floor(current)}/${max}`;
}

function renderCharacters() {
  battleState.party.forEach((member) => {
    const card = document.querySelector(`[data-character="${member.id}"]`);
    if (!card) return;

    card.classList.toggle("active", member.id === selectedCharacter);
    card.setAttribute('aria-pressed', String(member.id === selectedCharacter));
    card.querySelector(".character-name").textContent = member.name;
    card.querySelector(".character-realm").textContent = gradeText(member);
    renderBar(card.querySelector(".bar.hp"), member.hp, member.maxHp);
    renderBar(card.querySelector(".bar.spirit"), member.spirit, member.maxSpirit);

    const icons = card.querySelector(".status-icons");
    icons.replaceChildren(
      ...member.states.map((state) => {
        const icon = document.createElement("i");
        icon.textContent = state;
        icon.title = ({ 气: '文气护体', 墨: '笔墨在手', 守: '守势', 书: '通文', 静: '心神安定', 寒蚀: '寒蚀', 恐惧: '恐惧' })[state] || state;
        return icon;
      }),
    );
  });
}

function renderEnemy() {
  const enemy = battleState.enemy;
  enemyPanel.querySelector(".enemy-name").textContent = enemy.name;
  enemyPanel.querySelector(".enemy-realm").textContent = gradeText(enemy);
  renderBar(enemyPanel.querySelector(".enemy-hp"), enemy.hp, enemy.maxHp);
  renderBar(enemyPanel.querySelector(".enemy-spirit"), enemy.spirit, enemy.maxSpirit);
  const status = enemyPanel.querySelector('.enemy-combo-status');
  const marked = enemy.states.includes('灼痕');
  status.hidden = !marked;
  status.textContent = marked ? '灼痕已成 · 接「刀」伤害 ×1.6' : '';
}

function renderBattleMeta() {
  chapter.textContent = battleState.chapter;
  objective.textContent = battleState.objective;
  document.querySelector('#turn-label').textContent = battleEnded ? '战斗结束' : `第 ${battleState.turn.round} 回合 · ${battleState.turn.side === 'player' ? '我方行动' : '敌方行动'}`;
  document.querySelector('#replay-opening').disabled = !battleState.tutorialIntro || battleEnded || battleState.turn.side !== 'player';
  document.querySelector('.battlefield').classList.toggle('omen-awake', Boolean(battleState.tutorialOmenShown));
}

function renderAll() {
  renderBattleMeta();
  renderCharacters();
  renderEnemy();
}

function renderTags(tags) {
  infoTags.replaceChildren(
    ...tags.map((tag) => {
      const element = document.createElement("span");
      element.textContent = tag;
      return element;
    }),
  );
}

function showSkillInfo(skillId = selectedSkill, showTip = false) {
  const skill = skillData[skillId];
  if (!skill) return;
  const actor = getActor();
  const canAct = actor.hp > 0 && battleState.turn.side === 'player' && !battleEnded;
  const canCast = canAct && actor.spirit >= skill.spiritCost;
  restButton.disabled = !canAct;
  infoMode = "skill";

  infoTitle.textContent = skill.title;
  infoText.textContent = `${skill.text} 消耗精神 ${skill.spiritCost}，基础威力 ${skill.basePower}。施法者：${actor.name}。`;
  const reason = battleEnded ? '战斗结束' : battleState.turn.side !== 'player' ? '敌方行动中' : actor.hp <= 0 ? '已倒下' : '精神不足';
  renderTags([...skill.tags, canCast ? "可释放" : reason]);
  castButton.textContent = canCast ? (skill.requiresWriting ? '开始书写' : '释放术法') : reason;
  castButton.disabled = !canCast;
  document.querySelector('.enemy').classList.toggle('targeted', skill.target === 'enemy' && !battleEnded);
  if (showTip && battleState.turn.side === 'player' && !battleEnded && !writingDialog.open) {
    const comboHint = battleState.enemy.states.includes('灼痕') ? '火已咬住霜藤！现在写「刀」引爆灼痕，或让师父接这一刀。' : null;
    setMentorTip(comboHint || mentorSkillTips[skill.id] || "先看汉字牌的效果，再选择施法者。精神足够时，就可以开始书写。", 'guide', false, '');
  }
}

function selectSkill(skillId, showTip = false) {
  const skill = skillData[skillId];
  if (!skill) return;
  selectedSkill = skillId;

  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.skill === skillId);
    card.setAttribute('aria-pressed', String(card.dataset.skill === skillId));
  });
  showSkillInfo(skillId, showTip);
}

function selectCharacter(characterId) {
  if (openingActive || battleEnded || battleState.turn.side !== 'player') return;
  if (!battleState.party.some((member) => member.id === characterId)) return;
  selectedCharacter = characterId;
  renderCharacters();
  showSkillInfo();
}

function applySkill(writingScore = null) {
  if (openingActive) return;
  if (infoMode === "character") {
    showSkillInfo();
    return;
  }

  const skill = skillData[selectedSkill];
  const actor = getActor();
  if (!skill || !actor || actor.hp <= 0 || battleState.turn.side !== 'player' || battleEnded || actor.spirit < skill.spiritCost) {
    showSkillInfo();
    return;
  }

  if (skill.requiresWriting && !writingScore?.tier) {
    const rules = getWritingScoreRules(battleState.writingDifficulty);
    const perfectCoverage = Math.round(rules.perfectCoverage * 100);
    const perfectPrecision = Math.round(rules.perfectPrecision * 100);
    writingPending = { actorId: actor.id, skillId: selectedSkill };
    document.querySelector('#writing-title').textContent = `书写 · ${skill.char}`;
    resetWriting(skill.char);
    document.querySelector('.channel-glyph').textContent = skill.char;
    document.querySelector('.battlefield').dataset.channelSkill = skill.id;
    document.querySelector('.battlefield').style.setProperty('--channel-x', actor.id === 'shen_yan' ? '25%' : '12%');
    writingDialog.dataset.skill = skill.id;
    document.querySelector('.battlefield').classList.add('channeling');
    setWritingGuide(skill);
    const teaching = battleState.writingDifficulty === 'tutorial' ? '这一次，师父借你一缕文气。' : '';
    setMentorTip(`${teaching}看淡墨底字落笔：覆盖达到${perfectCoverage}%、准确达到${perfectPrecision}%，便能成术。`, 'guide', false, '顺着淡墨落笔。稳住笔锋。');
    writingDialog.showModal();
    startWritingTimer();
    return;
  }
  const power = skill.requiresWriting ? writingScore.power : 1;
  let comboTriggered = false;
  actor.spirit = clamp(actor.spirit - skill.spiritCost, 0, actor.maxSpirit);
  if (writingScore?.tier) showWritingFeedback(writingScore, skill, actor);

  if (power === 0) {
    setLog(`${actor.name} 的「${skill.char}」未能成形，施法失败。`);
  } else if (skill.effect === "damage") {
    comboTriggered = skillConsumesState(skill, battleState.enemy.states);
    const damage = Math.round(calculateDamage(actor, skill, battleState.enemy.defense, battleState.enemy.states) * power);
    battleState.enemy.hp = clamp(battleState.enemy.hp - damage, 0, battleState.enemy.maxHp);
    if (comboTriggered) {
      battleState.enemy.states = battleState.enemy.states.filter(state => state !== skill.consumesState);
      setLog(`${actor.name} 写下「${skill.char}」，火刀相接！焰刃破藤，造成 ${damage} 点伤害。`);
      showComboFeedback(actor);
    } else {
      setLog(`${actor.name} 释放「${skill.char}」，霜藤妖受到 ${damage} 点伤害。`);
    }
    if (battleState.enemy.hp > 0 && skillAppliesState(skill, power) && !battleState.enemy.states.includes(skill.appliesState)) {
      battleState.enemy.states.push(skill.appliesState);
      combatLog.textContent += ' 灼痕已成，下一笔接「刀」！';
    }
    if (skill.char === '火' || skill.char === '刀') {
      const currentBattle = battleState;
      setTimeout(() => {
        if (battleState === currentBattle) feedback('enemy', `-${damage}`);
      }, skill.char === '火' ? 780 : 520);
    } else {
      feedback('enemy', `-${damage}`);
    }
    showBattleOmen();
  }

  if (skill.effect === "control" && power >= .5) {
    battleState.turn.skipEnemy = true;
    if (!battleState.enemy.states.includes("定")) {
      battleState.enemy.states.push("定");
    }
    setLog(`${actor.name} 写下「${skill.char}」，霜藤妖将跳过一次反击。`);
  } else if (skill.effect === 'control' && power > 0) {
    setLog(`${actor.name} 的「${skill.char}」笔力不足，未能定住霜藤妖。`);
  }

  if (skill.effect === "cleanse" && power > 0) {
    const heal = Math.round(skill.basePower * power);
    actor.hp = clamp(actor.hp + heal, 0, actor.maxHp);
    if (power >= .5) actor.states = actor.states.filter(state => !['寒蚀', '恐惧'].includes(state));
    if (power >= .5 && !actor.states.includes("静")) {
      actor.states.push("静");
    }
    if (power >= .5) battleState.enemy.states = battleState.enemy.states.filter((state) => state !== "狂暴");
    setLog(`${actor.name} 写下「${skill.char}」，恢复 ${heal} 点生命${power >= .5 ? '，净化生效' : '，笔力不足以净化'}。`);
    const currentBattle = battleState;
    setTimeout(() => {
      if (battleState === currentBattle) feedback(actor.id, `+${heal}`);
    }, 320);
  }

  const sprite = document.querySelector(actor.id === 'shen_yan' ? '.hero' : '.mentor');
  sprite.classList.remove('acting');
  void sprite.offsetWidth;
  sprite.classList.add('acting');
  if (writingScore?.tier) {
    const teaching = battleState.writingDifficulty === 'tutorial' && writingScore.tier === 'perfect' ? '，师父文气助力' : '';
    combatLog.textContent += ` 笔迹契合 ${Math.round(writingScore.score * 100)}%，威力 ${Math.round(power * 100)}%${teaching}。`;
  }
  const fireCast = skill.char === '火' && power > 0;
  const finishingEffect = (skill.char === '刀' && power > 0) || writingScore?.tier === 'perfect';
  checkOutcome(fireCast ? 2000 : finishingEffect ? 1600 : 0);
  if (!battleEnded) beginEnemyTurn(actor.id, fireCast ? 1.2 : writingScore?.tier === 'perfect' ? 1 : power > 0 ? .7 : 0);
  renderAll();
  showSkillInfo();
  castButton.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(0.98)" },
      { transform: "scale(1)" },
    ],
    { duration: 180, easing: "ease-out" },
  );
}

function buildSavePayload() {
  return {
    version: 3,
    currentChapter: "volume_01_battle_mock",
    selectedSkill,
    selectedCharacter,
    unlockedChars: Object.values(skillData).map((skill) => skill.char).filter(Boolean),
    battleState,
    charMastery: {
      [selectedSkill]: {
        uses: 1,
        bestScore: skillData[selectedSkill]?.requiresWriting ? 0.82 : 0,
        averageScore: skillData[selectedSkill]?.requiresWriting ? 0.82 : 0,
      },
    },
  };
}

async function saveProgress() {
  const payload = buildSavePayload();
  saveLocal(payload);

  try {
    await saveServer(payload);
    setSaveStatus("进度已保存");
  } catch {
    setSaveStatus("已保存战斗数据到浏览器，本地服务未启用或接口不可用");
  }
}

function applySave(save) {
  document.querySelectorAll('.blade-companion').forEach(node => node.remove());
  if (save?.battleState) {
    battleState = clone(save.battleState);
  }
  selectedCharacter = save?.selectedCharacter || battleState.party[0].id;
  selectedSkill = save?.selectedSkill || battleState.selectedSkill || "dao";
  battleEnded = false;
  normalizeBattle();
  renderAll();
  selectSkill(selectedSkill);
  checkOutcome();
}

async function loadProgress() {
  try {
    const serverSave = await loadServerSave();
    applySave(serverSave);
    setSaveStatus("已读取服务端战斗存档");
    return;
  } catch {
    const localSave = loadLocalSave();
    if (localSave) {
      applySave(localSave);
      setSaveStatus("已读取浏览器战斗存档");
      return;
    }
    setSaveStatus("没有可读取的存档");
  }
}

cards.forEach((card) => {
  card.addEventListener("click", () => {
    if (!openingActive) selectSkill(card.dataset.skill, true);
  });
});

characterCards.forEach((card) => {
  card.addEventListener("click", () => selectCharacter(card.dataset.character));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCharacter(card.dataset.character);
    }
  });
});

castButton.addEventListener("click", applySkill);
saveButton.addEventListener("click", saveProgress);
loadButton.addEventListener("click", loadProgress);

async function init() {
  const [skills, battle] = await Promise.all([
    loadJson("/data/hanzi-skills.json", fallbackSkills),
    loadJson("/data/battle-state.json", null),
  ]);
  skillData = normalizeSkills(skills);
  battleState = clone(battle);
  initialBattle = clone(battle);
  const localSave = loadLocalSave();
  const resumedBattle = Boolean(localSave?.battleState);
  if (localSave?.battleState) {
    battleState = clone(localSave.battleState);
    selectedCharacter = localSave.selectedCharacter || selectedCharacter;
    selectedSkill = localSave.selectedSkill || selectedSkill;
  } else {
    selectedSkill = battleState.selectedSkill || selectedSkill;
  }
  normalizeBattle();
  renderAll();
  selectSkill(selectedSkill);
  setupBattleUI();
  checkOutcome();
  if (!resumedBattle && !battleEnded) showOpeningSequence();
  setInterval(tickBattle, 100);
}

function clearOpeningTimers() {
  openingTimers.forEach(clearTimeout);
  openingTimers = [];
}

function setOpeningPhase(phase, line, detail) {
  if (phase === 'trapped') document.querySelectorAll('.blade-companion').forEach(node => node.remove());
  if (phase === 'rescue') showBladeAttack(document.querySelector('.battlefield'), { id: 'lu_qingya' }, { tier: 'good', power: 1 }, false);
  openingSequence.dataset.phase = phase;
  document.querySelector('.battlefield').dataset.openingPhase = phase;
  openingLine.textContent = line;
  openingDetail.textContent = detail;
  document.querySelector('#opening-start').hidden = phase !== 'ready';
  if (phase === 'ready') document.querySelector('#opening-start').focus();
}

function showOpeningSequence() {
  if (!battleState.tutorialIntro) return;
  clearOpeningTimers();
  hideMentorTip();
  openingActive = true;
  openingSequence.hidden = false;
  document.querySelector('.game-shell').classList.add('intro-mode');
  document.querySelector('.hud').inert = true;
  document.querySelector('.pause-button').disabled = true;
  document.querySelector('.battlefield').classList.add('opening-active');
  document.querySelector('.battlefield').classList.remove('omen-awake');
  setOpeningPhase('trapped', '醒来时，霜藤已经缠住了你。', '笔还在手中，却一个字也写不出。');
  document.querySelector('#opening-skip').focus();
  openingTimers.push(setTimeout(() => {
    setOpeningPhase('rescue', '陆青崖只写了一个字：刀。', '墨锋斩断妖藤，雪林里第一次响起字的力量。');
  }, 1500));
  openingTimers.push(setTimeout(() => {
    setOpeningPhase('ready', '师父退开，剩下这一击交给你。', '写「火」烧开霜藤，再接师父的「刀」——让两个字连成一招。');
  }, 3700));
}

function finishOpening(startWriting) {
  if (!openingActive) return;
  clearOpeningTimers();
  openingActive = false;
  openingSequence.hidden = true;
  document.querySelector('.game-shell').classList.remove('intro-mode');
  document.querySelector('.hud').inert = false;
  document.querySelector('.pause-button').disabled = false;
  document.querySelector('.battlefield').classList.remove('opening-active');
  delete document.querySelector('.battlefield').dataset.openingPhase;
  document.querySelector('.battlefield').classList.toggle('omen-awake', Boolean(battleState.tutorialOmenShown));
  selectSkill('dao');
  if (startWriting) {
    playCue('draw');
    applySkill();
  } else {
    castButton.focus();
  }
}

document.querySelector('#opening-skip').addEventListener('click', () => finishOpening(false));
document.querySelector('#opening-start').addEventListener('click', () => finishOpening(true));

function showBattleOmen() {
  if (!battleState.tutorialIntro || battleState.tutorialOmenShown || battleState.enemy.hp <= 0 || battleState.enemy.hp > battleState.enemy.maxHp / 2) return;
  battleState.tutorialOmenShown = true;
  battleOmen.hidden = false;
  battleOmen.classList.remove('shown');
  void battleOmen.offsetWidth;
  battleOmen.classList.add('shown');
  playCue('omen');
  clearTimeout(omenTimer);
  omenTimer = setTimeout(() => { battleOmen.hidden = true; }, 2800);
}

function feedback(target, text) {
  const node = document.createElement('span');
  node.className = 'floating-number';
  node.textContent = text;
  node.style.left = target === 'enemy' ? '76%' : target === 'shen_yan' ? '25%' : '12%';
  document.querySelector('.battlefield').append(node);
  const sprite = document.querySelector(target === 'enemy' ? '.enemy' : target === 'shen_yan' ? '.hero' : '.mentor');
  sprite.classList.remove('hit');
  void sprite.offsetWidth;
  sprite.classList.add('hit');
  setTimeout(() => node.remove(), 1000);
}

function checkOutcome(resultDelay = 0) {
  if (battleEnded || !battleState) return;
  const result = getBattleResult(battleState);
  if (result === 'ongoing') return;
  const win = result === 'win';
  battleEnded = true;
  hideMentorTip();
  writingDialog.close();
  menuDialog.close();
  document.querySelector('#result-title').textContent = win ? '妖邪已退' : '力竭倒下';
  document.querySelector('#result-text').textContent = win ? '雪林暂安，此战告捷。' : '霜藤封路，整装再战。';
  document.querySelector('.result-hook').hidden = !win || !battleState.tutorialIntro;
  const revealResult = () => {
    if (win) playCue('victory');
    resultDialog.showModal();
    resultTimer = null;
  };
  if (win && resultDelay > 0) resultTimer = setTimeout(revealResult, resultDelay);
  else revealResult();
}

function normalizeBattle() {
  normalizeBattleState(battleState);
  hideMentorTip();
  clearTimeout(omenTimer);
  clearTimeout(resultTimer);
  resultTimer = null;
  battleOmen.hidden = true;
  if (!battleState.writingDifficulty) {
    battleState.writingDifficulty = battleState.chapter === initialBattle?.chapter
      ? initialBattle.writingDifficulty || 'standard'
      : 'standard';
  }
  if (typeof battleState.tutorialIntro !== 'boolean') {
    battleState.tutorialIntro = battleState.chapter === initialBattle?.chapter && Boolean(initialBattle?.tutorialIntro);
  }
  battleState.tutorialOmenShown ||= false;
  battleState.tutorialFirstPerfectShown ||= false;
  enemyDelay = 0;
  lastTick = performance.now();
}

function beginEnemyTurn(targetId, extraDelay = 0) {
  battleState.turn.side = 'enemy';
  battleState.turn.targetId = targetId;
  enemyDelay = -extraDelay;
  lastTick = performance.now();
}

function tickBattle() {
  const now = performance.now();
  const dt = Math.min((now - lastTick) / 1000, .25);
  lastTick = now;
  if (!battleState || battleEnded || writingDialog.open || menuDialog.open || document.hidden || battleState.turn.side !== 'enemy') return;
  enemyDelay += dt;
  if (enemyDelay < .9) return;
  if (battleState.turn.skipEnemy) {
    combatLog.textContent += ' 霜藤妖被定住，无法反击。';
    battleState.turn.skipEnemy = false;
    battleState.enemy.states = battleState.enemy.states.filter(state => state !== '定');
  } else {
    const target = battleState.party.find(member => member.id === battleState.turn.targetId && member.hp > 0) || battleState.party.find(member => member.hp > 0);
    if (target) {
      const damage = Math.max(1, battleState.enemy.attack - target.defense);
      target.hp = Math.max(0, target.hp - damage);
      combatLog.textContent += ` 霜藤妖反击，${target.name}受到 ${damage} 点伤害。`;
      feedback(target.id, `-${damage}`);
      checkOutcome();
    }
  }
  if (!battleEnded) {
    battleState.turn.side = 'player';
    battleState.turn.round++;
    battleState.turn.targetId = null;
    if (getActor().hp <= 0) selectedCharacter = battleState.party.find(member => member.hp > 0).id;
  }
  renderAll();
  showSkillInfo();
}

function setupBattleUI() {
  cards.forEach(card => {
    const skill = skillData[card.dataset.skill];
    if (skill) {
      card.querySelector('.skill-char').textContent = skill.char;
      card.querySelector('.skill-name').textContent = skill.shortName || skill.title;
    }
    card.removeAttribute('role');
    const cost = document.createElement('span');
    cost.className = 'skill-cost';
    cost.textContent = `精神 ${skillData[card.dataset.skill]?.spiritCost || 0}`;
    card.append(cost);
  });
  document.querySelector('.skills-panel').removeAttribute('role');
  characterCards.forEach(card => card.setAttribute('role', 'button'));
}

const canvas = document.querySelector('#writing-canvas');
const context = canvas.getContext('2d');
const template = document.createElement('canvas');
template.width = template.height = 400;
const templateContext = template.getContext('2d', { willReadFrequently: true });
const ink = document.createElement('canvas');
ink.width = ink.height = 400;
const inkContext = ink.getContext('2d', { willReadFrequently: true });
let drawing = false;
let hasInk = false;
let templateMask;
let brushStrokes = [];
let activeStroke = null;
let brushFrame = null;
let activePointer = null;
let writingDeadline = 0;
let writingTimer = null;
const countdown = document.querySelector('#writing-countdown');
const writingLivePower = document.querySelector('#writing-live-power');
const writingLiveFill = document.querySelector('#writing-live-fill');
let lastWritingPreview = 0;
const BRUSH_MIN_WIDTH = 7;
const BRUSH_MAX_WIDTH = 28;
const BRUSH_BLOOM_DELAY = 180;
const BRUSH_BLOOM_DURATION = 1100;

function stopWriting() {
  clearInterval(writingTimer);
  writingTimer = null;
  finishActiveStroke();
  drawing = false;
  stopBrushBloom();
  if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
  activePointer = null;
}

function stopBrushBloom() {
  if (brushFrame !== null) cancelAnimationFrame(brushFrame);
  brushFrame = null;
}

function finishActiveStroke() {
  if (!activeStroke) return;
  activeStroke.complete = activeStroke.points.length > 1;
  const tip = activeStroke.points.at(-1);
  tip.pressure = clamp(tip.pressure + activeStroke.hold * 0.16, 0, 1);
  activeStroke = null;
  renderInk();
  updateWritingPreview(true);
}

function updateWritingTimer() {
  if (!writingPending || !writingDialog.open) return;
  const remaining = Math.max(0, Math.ceil((writingDeadline - Date.now()) / 1000));
  countdown.textContent = `${remaining}秒`;
  countdown.classList.toggle('urgent', remaining <= 5);
  if (remaining === 0) finishWriting('timeout');
}

function startWritingTimer() {
  clearInterval(writingTimer);
  writingDeadline = Date.now() + 30000;
  updateWritingTimer();
  writingTimer = setInterval(updateWritingTimer, 100);
}

function drawWriting() {
  context.clearRect(0, 0, 400, 400);
  context.strokeStyle = '#cbbfa9';
  context.lineWidth = 1;
  context.setLineDash([5, 5]);
  context.beginPath();
  context.moveTo(200, 0); context.lineTo(200, 400);
  context.moveTo(0, 200); context.lineTo(400, 200);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = .18;
  context.drawImage(template, 0, 0);
  context.globalAlpha = 1;
  context.save();
  context.shadowColor = writingInkGlow[writingPending?.skillId] || '#d7c7a4';
  context.shadowBlur = 14;
  context.drawImage(ink, 0, 0);
  context.restore();
}

function markInk() {
  hasInk = true;
  document.querySelector('#submit-writing').disabled = false;
}

function turnAmount(a, b) {
  if (!a || !b) return 0;
  const dot = clamp(a.x * b.x + a.y * b.y, -1, 1);
  return Math.acos(dot) / Math.PI;
}

function makeStroke(start, time, pressure) {
  return {
    points: [{ ...start, time, pressure, velocity: 0.45, turn: 0, length: 0 }],
    rawPoint: start,
    direction: null,
    holdStartedAt: time,
    hold: 0,
    renderedHold: -1,
    complete: false,
  };
}

function addStrokePoint(stroke, rawPoint, time, inputPressure = null) {
  const last = stroke.points.at(-1);
  const rawDistance = Math.hypot(rawPoint.x - stroke.rawPoint.x, rawPoint.y - stroke.rawPoint.y);
  stroke.rawPoint = rawPoint;
  if (rawDistance < 0.65) return false;

  const streamline = clamp(0.3 + rawDistance / 45, 0.3, 0.56);
  const next = {
    x: last.x + (rawPoint.x - last.x) * streamline,
    y: last.y + (rawPoint.y - last.y) * streamline,
  };
  const dx = next.x - last.x;
  const dy = next.y - last.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.35) return false;

  const direction = { x: dx / distance, y: dy / distance };
  const turn = turnAmount(stroke.direction, direction);
  const instantVelocity = distance / Math.max(4, time - last.time);
  const velocity = last.velocity * 0.72 + instantVelocity * 0.28;
  const simulated = 0.22 + clamp(1 - velocity / 1.15, 0, 1) * 0.68;
  const targetPressure = inputPressure === null ? simulated : clamp(inputPressure, 0.08, 1);
  const cornerPressure = clamp((turn - 0.08) / 0.34, 0, 1) * 0.12;
  const pressure = clamp(last.pressure * 0.64 + targetPressure * 0.36 + cornerPressure, 0.08, 1);

  stroke.points.push({
    ...next,
    time,
    pressure,
    velocity,
    turn,
    length: last.length + distance,
  });
  stroke.direction = direction;
  stroke.holdStartedAt = time;
  stroke.hold = 0;
  return true;
}

function pointRadius(stroke, index) {
  const point = stroke.points[index];
  let radius = (BRUSH_MIN_WIDTH + (BRUSH_MAX_WIDTH - BRUSH_MIN_WIDTH) * point.pressure) / 2;
  const startTaper = clamp((point.length + 3) / 13, 0.24, 1);
  radius *= startTaper;

  if (point.turn > 0.14) radius *= 1 + Math.min(point.turn, 0.55) * 0.18;
  if (!stroke.complete && index === stroke.points.length - 1) radius += stroke.hold * 7;
  if (stroke.complete) {
    const total = stroke.points.at(-1).length;
    const remaining = total - point.length;
    radius *= clamp((remaining + 1.2) / 12, 0.1, 1);
  }
  return Math.max(0.8, radius);
}

function strokeOutline(stroke) {
  if (stroke.points.length < 2) return null;
  const left = [];
  const right = [];
  for (let index = 0; index < stroke.points.length; index++) {
    const point = stroke.points[index];
    const before = stroke.points[Math.max(0, index - 1)];
    const after = stroke.points[Math.min(stroke.points.length - 1, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const radius = pointRadius(stroke, index);
    const nx = -dy / length;
    const ny = dx / length;
    left.push({ x: point.x + nx * radius, y: point.y + ny * radius, turn: point.turn });
    right.push({ x: point.x - nx * radius, y: point.y - ny * radius, turn: point.turn });
  }
  return { left, right };
}

function traceBrushSide(points) {
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    const next = points[index + 1];
    if (point.turn > 0.18) inkContext.lineTo(point.x, point.y);
    else inkContext.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }
  const last = points.at(-1);
  inkContext.lineTo(last.x, last.y);
}

function renderStroke(stroke) {
  const outline = strokeOutline(stroke);
  if (!outline) {
    const point = stroke.points[0];
    const radius = pointRadius(stroke, 0) + stroke.hold * 5;
    inkContext.beginPath();
    inkContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
    inkContext.fill();
    return;
  }

  inkContext.beginPath();
  inkContext.moveTo(outline.left[0].x, outline.left[0].y);
  traceBrushSide(outline.left);
  const returningSide = [...outline.right].reverse();
  inkContext.lineTo(returningSide[0].x, returningSide[0].y);
  traceBrushSide(returningSide);
  inkContext.closePath();
  inkContext.fill();
}

function renderInk() {
  inkContext.clearRect(0, 0, 400, 400);
  inkContext.save();
  inkContext.fillStyle = '#161b19';
  inkContext.globalAlpha = 0.9;
  brushStrokes.forEach(renderStroke);
  inkContext.restore();
  if (brushStrokes.length) markInk();
  drawWriting();
  updateWritingPreview();
}

function updateWritingPreview(force = false) {
  if (!writingPending || !writingDialog.open || !templateMask) return;
  const now = performance.now();
  if (!force && now - lastWritingPreview < 120) return;
  lastWritingPreview = now;
  const pixels = inkContext.getImageData(0, 0, 400, 400).data;
  const result = scoreWriting(templateMask, pixels, getWritingScoreRules(battleState.writingDifficulty));
  const power = Math.round(result.power * 100);
  writingLivePower.textContent = `${power}%`;
  writingLiveFill.style.width = `${power}%`;
  writingLiveFill.classList.toggle('perfect', result.tier === 'perfect');
  const field = document.querySelector('.battlefield');
  field.style.setProperty('--writing-opacity', String(.2 + result.power * .8));
  field.style.setProperty('--writing-scale', String(.55 + result.power * .55));
  field.classList.toggle('writing-ready', result.tier === 'perfect');
}

function bloomBrush(now) {
  if (!drawing || !activeStroke) return;
  if (Date.now() >= writingDeadline) { finishWriting('timeout'); return; }
  const held = Math.max(0, now - activeStroke.holdStartedAt - BRUSH_BLOOM_DELAY);
  const progress = clamp(held / BRUSH_BLOOM_DURATION, 0, 1);
  activeStroke.hold = 1 - (1 - progress) ** 2;
  if (activeStroke.hold - activeStroke.renderedHold >= 0.025) {
    activeStroke.renderedHold = activeStroke.hold;
    renderInk();
  }
  brushFrame = requestAnimationFrame(bloomBrush);
}

function startBrush() {
  stopBrushBloom();
  brushFrame = requestAnimationFrame(bloomBrush);
}

function resetWriting(char) {
  drawing = false;
  hasInk = false;
  brushStrokes = [];
  activeStroke = null;
  stopBrushBloom();
  if (activePointer !== null && canvas.hasPointerCapture(activePointer)) canvas.releasePointerCapture(activePointer);
  activePointer = null;
  templateContext.clearRect(0, 0, 400, 400);
  templateContext.fillStyle = '#171714';
  templateContext.font = '300px KaiTi, STKaiti, SimSun, serif';
  templateContext.textAlign = 'center';
  templateContext.textBaseline = 'middle';
  templateContext.fillText(char, 200, 210);
  if (char === '一') {
    templateContext.clearRect(0, 0, 400, 400);
    templateContext.strokeStyle = '#171714';
    templateContext.lineWidth = 14;
    templateContext.lineCap = 'round';
    templateContext.beginPath();
    templateContext.moveTo(70, 200);
    templateContext.lineTo(330, 200);
    templateContext.stroke();
  }
  templateMask = templateContext.getImageData(0, 0, 400, 400).data;
  inkContext.clearRect(0, 0, 400, 400);
  document.querySelector('#writing-result').textContent = '落笔凝字';
  document.querySelector('#submit-writing').disabled = true;
  writingLivePower.textContent = '0%';
  writingLiveFill.style.width = '0%';
  writingLiveFill.classList.remove('perfect');
  document.querySelector('.battlefield').style.setProperty('--writing-opacity', '.3');
  document.querySelector('.battlefield').style.setProperty('--writing-scale', '.62');
  document.querySelector('.battlefield').classList.remove('writing-ready');
  drawWriting();
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * 400 / rect.width, y: (event.clientY - rect.top) * 400 / rect.height };
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || activePointer !== null || !writingPending) return;
  if (Date.now() >= writingDeadline) { finishWriting('timeout'); return; }
  activePointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  drawing = true;
  const start = point(event);
  const pressure = event.pointerType === 'pen' ? event.pressure : 0.4;
  activeStroke = makeStroke(start, event.timeStamp || performance.now(), pressure);
  brushStrokes.push(activeStroke);
  markInk();
  renderInk();
  startBrush();
});
function continueStroke(event) {
  if (!drawing || event.pointerId !== activePointer) return;
  if (Date.now() >= writingDeadline) { finishWriting('timeout'); return; }
  const samples = event.getCoalescedEvents?.() || [event];
  let changed = false;
  for (const sample of samples) {
    const pressure = sample.pointerType === 'pen' ? sample.pressure : null;
    changed = addStrokePoint(activeStroke, point(sample), sample.timeStamp || performance.now(), pressure) || changed;
  }
  if (changed) renderInk();
  const next = point(event);
  if (next.x < 0 || next.x > 400 || next.y < 0 || next.y > 400) finishWriting('edge');
}
canvas.addEventListener('pointermove', continueStroke);
canvas.addEventListener('pointerup', event => {
  continueStroke(event);
  if (event.pointerId === activePointer) {
    finishActiveStroke();
    drawing = false;
    stopBrushBloom();
    activePointer = null;
  }
});
for (const name of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => {
  if (event.pointerId === activePointer) {
    finishActiveStroke();
    drawing = false;
    stopBrushBloom();
    activePointer = null;
  }
});
document.querySelector('#clear-writing').addEventListener('click', () => resetWriting(skillData[writingPending.skillId].char));
function finishWriting(reason) {
  if (!writingPending || !writingDialog.open || (!hasInk && reason !== 'timeout')) return;
  const pending = writingPending;
  writingPending = null;
  stopWriting();
  writingDialog.close();
  document.querySelector('.battlefield').classList.remove('channeling', 'writing-ready');
  delete document.querySelector('.battlefield').dataset.channelSkill;
  document.querySelector('.battlefield').style.removeProperty('--channel-x');
  delete writingDialog.dataset.skill;
  if (!hasInk) {
    setLog('书写时间已到，尚未落笔，请重新选招。');
    setMentorTip("未落笔不会消耗精神。下一次先稳住呼吸，再从淡墨最清楚的一笔开始。", 'warn', false, '还未落笔，不耗精神。再试一次。');
    return;
  }
  const pixels = inkContext.getImageData(0, 0, 400, 400).data;
  const score = scoreWriting(templateMask, pixels, getWritingScoreRules(battleState.writingDifficulty));
  selectedCharacter = pending.actorId;
  selectedSkill = pending.skillId;
  applySkill(score);
}

function showWritingFeedback(result, skill, actor) {
  const skillCue = { 火: 'fire', 刀: 'slash', 止: 'seal', 生: 'heal' };
  playCue(result.power > 0 ? skillCue[skill.char] || 'perfect' : 'omen');
  speak(skill.char, actor.id === 'shen_yan' ? 'hero' : 'mentor', { interrupt: true });
  const field = document.querySelector('.battlefield');
  field.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  field.querySelectorAll('.writing-verdict, .enemy-taunt, .ink-burst, .perfect-ritual, .skill-effect').forEach(node => node.remove());
  const coverage = Math.round(result.coverage * 100);
  const precision = Math.round(result.precision * 100);
  const teachingBoost = result.tier === 'perfect' && battleState.writingDifficulty === 'tutorial';
  const perfectCoverage = Math.round(result.perfectCoverage * 100);
  const perfectPrecision = Math.round(result.perfectPrecision * 100);
  const verdict = document.createElement('div');
  verdict.className = `writing-verdict ${result.tier}`;
  const title = document.createElement('strong');
  const verdictName = teachingBoost ? '初悟成字' : ({ perfect: '神完气足', good: '笔力遒劲', normal: '初具字形', weak: '笔力微弱', flooded: '墨乱神散' })[result.tier];
  title.textContent = `${verdictName} · ${Math.round(result.power * 100)}%威力`;
  const detail = document.createElement('span');
  detail.textContent = `笔迹契合 ${Math.round(result.score * 100)}% · 覆盖 ${coverage}% · 准确 ${precision}%${teachingBoost ? ' · 文气助力' : ''}`;
  verdict.append(title, detail);
  field.append(verdict);
  setTimeout(() => verdict.remove(), 4200);
  if (result.tier === 'perfect') {
    if (battleState.tutorialIntro && !battleState.tutorialFirstPerfectShown) {
      battleState.tutorialFirstPerfectShown = true;
      field.classList.add('first-awakening');
      setTimeout(() => field.classList.remove('first-awakening'), 2100);
      setMentorTip('好！师父借你一缕文气，字已成术。继续落笔，试试别的字。', 'praise', true, '好字！这一笔成了。');
    } else {
      setMentorTip(`好字！覆盖 ${coverage}%、准确 ${precision}%，达到本关的${perfectCoverage}%与${perfectPrecision}%要求，这一击便是完美书写。`, 'praise', true, '好字！笔势圆满。');
    }
  } else if (result.tier === 'flooded') {
    setMentorTip(`墨铺得太满，空白也被吞了。宁可少写一分，也别把画布涂成一团。`, 'warn', true, '墨铺得太满。留些空白。');
  } else if (result.tier === 'weak') {
    setMentorTip(`笔画偏得多了些。先追淡墨的骨架，覆盖上去，再谈速度。`, 'warn', true, '笔画偏了。贴着淡墨再写。');
  } else if (result.power >= .5) {
    setMentorTip(`已能成招。想要完美，就让覆盖达到${perfectCoverage}%、准确达到${perfectPrecision}%。`, 'guide', true, '字已成形。再稳一点。');
  } else {
    setMentorTip(`字形已起，但笔力还浅。少写空白，多贴淡墨，威力会立刻上来。`, 'guide', true, '笔力还浅。再贴近淡墨。');
  }
  if (['weak', 'flooded'].includes(result.tier)) {
    const taunt = document.createElement('div');
    taunt.className = 'enemy-taunt';
    taunt.textContent = result.tier === 'flooded' ? '走火入魔了吗' : '字都不会写了吗';
    speak(taunt.textContent, 'enemy');
    field.append(taunt);
    setTimeout(() => taunt.remove(), 4200);
  }
  if (result.power > 0) {
    if (skill.char === '火') {
      showFireAttack(field, actor, result);
      return;
    }
    if (skill.char === '刀') {
      showBladeAttack(field, actor, result, skillConsumesState(skill, battleState.enemy.states));
      return;
    }
    if (skill.char === '止') {
      showStopSeal(field, result);
      return;
    }
    if (skill.char === '生') {
      showLifeBloom(field, actor, result);
      return;
    }
    const burst = document.createElement('div');
    burst.className = `ink-burst ${result.tier} ${skill.effect} skill-${skill.id}`;
    burst.style.left = actor.id === 'shen_yan' ? '25%' : '12%';
    burst.style.setProperty('--target-x', skill.effect === 'cleanse' ? (actor.id === 'shen_yan' ? '25%' : '12%') : '76%');
    burst.textContent = skill.char;
    field.append(burst);
    if (result.tier === 'perfect') {
      showPerfectRitual(field, skill, actor);
    }
    setTimeout(() => burst.remove(), result.tier === 'perfect' ? 1500 : 1100);
  }
}

function showFireAttack(field, actor, result) {
  const attack = document.createElement('div');
  attack.className = `skill-effect fire-attack ${result.tier}`;
  attack.setAttribute('aria-hidden', 'true');
  attack.style.setProperty('--cast-x', actor.id === 'shen_yan' ? '25%' : '12%');
  attack.style.setProperty('--target-x', '76%');

  for (const part of ['fire-ignition', 'fire-trail', 'fire-impact']) {
    const node = document.createElement('span');
    node.className = part;
    attack.append(node);
  }
  for (let i = 0; i < 12; i++) {
    const flame = document.createElement('i');
    flame.className = 'fire-tongue';
    flame.style.setProperty('--fire-delay', `${i * 46}ms`);
    flame.style.setProperty('--fire-rise', `${(i % 5 - 2) * 18}px`);
    flame.style.setProperty('--flame-size', `${18 + i % 4 * 9}px`);
    attack.append(flame);
  }
  for (let i = 0; i < 18; i++) {
    const ember = document.createElement('i');
    ember.className = 'fire-ember';
    const angle = i * 2.39996;
    const radius = 38 + i % 5 * 17;
    ember.style.setProperty('--ember-x', `${Math.cos(angle) * radius}px`);
    ember.style.setProperty('--ember-y', `${Math.sin(angle) * radius * .8}px`);
    ember.style.setProperty('--ember-delay', `${i % 6 * 38}ms`);
    attack.append(ember);
  }
  field.append(attack);
  setTimeout(() => attack.remove(), result.tier === 'perfect' ? 2100 : 1850);
}

function showBladeAttack(field, actor, result, combo) {
  const owner = field.querySelector(actor.id === 'shen_yan' ? '.hero' : '.mentor');
  let companion = owner.querySelector('.blade-companion');
  if (!companion) {
    companion = document.createElement('img');
    companion.className = 'blade-companion';
    companion.src = 'src/assets/summoned-blade.svg';
    companion.alt = '悬浮护身的召唤刀';
    companion.draggable = false;
    owner.append(companion);
  }
  companion.classList.toggle('flaming', combo);
  const attack = document.createElement('div');
  attack.className = `skill-effect blade-attack ${result.tier}${combo ? ' combo' : ''}`;
  attack.setAttribute('aria-hidden', 'true');
  attack.style.setProperty('--cast-x', actor.id === 'shen_yan' ? '25%' : '12%');
  attack.style.setProperty('--target-x', '76%');
  const summon = document.createElement('div');
  summon.className = 'blade-summon';
  const weapon = document.createElement('img');
  weapon.className = 'summoned-blade';
  weapon.src = 'src/assets/summoned-blade.svg';
  weapon.alt = '';
  weapon.draggable = false;
  summon.append(weapon);
  if (combo) {
    const flames = document.createElement('span');
    flames.className = 'blade-flames';
    for (let i = 0; i < 9; i++) {
      const flame = document.createElement('i');
      flame.style.setProperty('--flame-position', `${28 + i * 7}%`);
      flame.style.setProperty('--flame-delay', `${-i * 83}ms`);
      flame.style.setProperty('--flame-height', `${75 + i % 3 * 20}%`);
      flames.append(flame);
    }
    summon.append(flames);
  }
  attack.append(summon);
  for (const part of ['blade-summon-ring', 'blade-dash', 'blade-flash']) {
    const node = document.createElement('span');
    node.className = part;
    attack.append(node);
  }
  for (let i = 0; i < 3; i++) {
    const cut = document.createElement('span');
    cut.className = 'blade-cut';
    cut.style.setProperty('--cut-y', `${(i - 1) * 22}px`);
    cut.style.setProperty('--cut-delay', `${i * 100}ms`);
    attack.append(cut);
  }
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement('i');
    spark.className = 'blade-spark';
    const angle = i * 2.39996;
    const radius = 45 + i % 4 * 20;
    spark.style.setProperty('--spark-x', `${Math.cos(angle) * radius}px`);
    spark.style.setProperty('--spark-y', `${Math.sin(angle) * radius}px`);
    spark.style.setProperty('--spark-delay', `${i % 5 * 35}ms`);
    attack.append(spark);
  }
  field.append(attack);
  setTimeout(() => attack.remove(), 2100);
}

function showStopSeal(field, result) {
  const attack = document.createElement('div');
  attack.className = `skill-effect stop-effect ${result.power >= .5 ? 'sealed' : 'fizzle'} ${result.tier}`;
  attack.setAttribute('aria-hidden', 'true');
  for (const part of ['stop-ring', 'stop-stamp']) {
    const node = document.createElement('span');
    node.className = part;
    if (part === 'stop-stamp') node.textContent = '止';
    attack.append(node);
  }
  for (let i = 0; i < 5; i++) {
    const band = document.createElement('span');
    band.className = 'stop-script-band';
    band.textContent = '止 · 止 · 止 · 止 · 止 · 止';
    band.style.setProperty('--band-y', `${36 + i * 7}%`);
    band.style.setProperty('--band-angle', `${i % 2 ? -12 : 12}deg`);
    band.style.setProperty('--band-delay', `${i * 90}ms`);
    attack.append(band);
  }
  field.append(attack);
  if (result.power >= .5) {
    const enemy = field.querySelector('.enemy');
    enemy.classList.add('sealed-visual');
    setTimeout(() => enemy.classList.remove('sealed-visual'), 1350);
  }
  setTimeout(() => attack.remove(), 1650);
}

function showLifeBloom(field, actor, result) {
  const attack = document.createElement('div');
  attack.className = `skill-effect life-effect ${result.tier}`;
  attack.setAttribute('aria-hidden', 'true');
  attack.style.setProperty('--heal-x', actor.id === 'shen_yan' ? '25%' : '12%');
  for (const part of ['life-aura', 'life-ring', 'life-ring inner', 'life-totem']) {
    const node = document.createElement('span');
    node.className = part;
    if (part === 'life-totem') node.textContent = '生';
    attack.append(node);
  }
  for (let i = 0; i < 5; i++) {
    const vine = document.createElement('span');
    vine.className = 'life-vine';
    vine.style.setProperty('--vine-x', `${(i - 2) * 27}px`);
    vine.style.setProperty('--vine-angle', `${(i - 2) * 13}deg`);
    vine.style.setProperty('--vine-delay', `${i * 80}ms`);
    const flower = document.createElement('span');
    flower.className = 'life-flower';
    for (let petalIndex = 0; petalIndex < 5; petalIndex++) {
      const petal = document.createElement('i');
      petal.style.rotate = `${petalIndex * 72}deg`;
      flower.append(petal);
    }
    vine.append(flower);
    attack.append(vine);
  }
  for (let i = 0; i < 16; i++) {
    const mote = document.createElement('i');
    mote.className = 'life-mote';
    mote.style.setProperty('--mote-x', `${(i % 7 - 3) * 19}px`);
    mote.style.setProperty('--mote-rise', `${60 + i % 5 * 21}px`);
    mote.style.setProperty('--mote-delay', `${i % 6 * 70}ms`);
    attack.append(mote);
  }
  field.append(attack);
  setTimeout(() => attack.remove(), 1750);
}

function showPerfectRitual(field, skill, actor) {
  const ritual = document.createElement('div');
  ritual.className = `perfect-ritual perfect-${skill.effect} skill-${skill.id}`;
  ritual.setAttribute('aria-hidden', 'true');
  ritual.style.setProperty('--cast-x', actor.id === 'shen_yan' ? '25%' : '12%');
  ritual.style.setProperty('--target-x', skill.effect === 'cleanse' ? (actor.id === 'shen_yan' ? '25%' : '12%') : '76%');

  for (const part of ['perfect-flash', 'perfect-sigil', 'perfect-stream', 'perfect-impact']) {
    const node = document.createElement('span');
    node.className = part;
    ritual.append(node);
  }
  for (let i = 0; i < 32; i++) {
    const spark = document.createElement('i');
    spark.className = `perfect-spark ${i < 16 ? 'at-cast' : 'at-impact'}`;
    const angle = i * 2.39996;
    const radius = 52 + (i % 5) * 22;
    spark.style.setProperty('--spark-x', `${Math.cos(angle) * radius}px`);
    spark.style.setProperty('--spark-y', `${Math.sin(angle) * radius * .7}px`);
    spark.style.setProperty('--spark-delay', `${(i % 6) * 45}ms`);
    ritual.append(spark);
  }
  field.append(ritual);
  setTimeout(() => ritual.remove(), 2000);
}

function showComboFeedback(actor) {
  const field = document.querySelector('.battlefield');
  const banner = document.createElement('div');
  banner.className = 'combo-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = actor.id === 'lu_qingya' ? '师徒接力 · 火刀破藤！' : '火刀连字 · 焰刃破藤！';
  field.append(banner);
  playCue('perfect');
  setTimeout(() => banner.remove(), 2200);
}
document.querySelector('#submit-writing').addEventListener('click', () => finishWriting('button'));
writingDialog.addEventListener('close', () => {
  if (!writingDialog.open) {
    stopWriting();
    writingPending = null;
    document.querySelector('.battlefield').classList.remove('channeling', 'writing-ready');
    delete document.querySelector('.battlefield').dataset.channelSkill;
    document.querySelector('.battlefield').style.removeProperty('--channel-x');
    delete writingDialog.dataset.skill;
  }
});
document.addEventListener('visibilitychange', updateWritingTimer);
document.querySelector('.pause-button').addEventListener('click', () => menuDialog.showModal());
document.querySelector('#resume-battle').addEventListener('click', () => menuDialog.close());
document.querySelector('#replay-opening').addEventListener('click', () => {
  if (!battleState.tutorialIntro || battleEnded || battleState.turn.side !== 'player') return;
  menuDialog.close();
  showOpeningSequence();
});
document.querySelector('#restart-battle').addEventListener('click', () => {
  stopVoice();
  battleState = clone(initialBattle);
  selectedCharacter = battleState.party[0].id;
  battleEnded = false;
  normalizeBattle();
  resultDialog.close();
  renderAll();
  selectSkill('dao');
  setLog('雪林交锋，再起笔锋。');
  showOpeningSequence();
});
resultDialog.addEventListener('cancel', event => event.preventDefault());

restButton.addEventListener('click', () => {
  const actor = getActor();
  if (openingActive || battleEnded || battleState.turn.side !== 'player' || actor.hp <= 0) return;
  const restored = Math.min(20, actor.maxSpirit - actor.spirit);
  actor.spirit += restored;
  setLog(`${actor.name} 调息，恢复 ${Math.floor(restored)} 点精神。`);
  setMentorTip("调息也算一次行动。精神不足时可用，但要准备承受妖物反击。", 'guide', false, '调息回气。留心反击。');
  beginEnemyTurn(actor.id);
  renderAll();
  showSkillInfo();
});

init().catch(() => { setLog('战斗数据加载失败，请刷新重试。'); castButton.disabled = true; });
