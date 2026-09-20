import { loadLocalSave, loadServerSave, saveLocal, saveServer } from "./storage.js";
import { scoreWriting } from './writing-score.js';
import { speak, stopVoice } from './voice.js';

const fallbackSkills = [
  {
    id: "zhan",
    char: "刀",
    title: "墨刀",
    text: "凝字为刃，对霜藤妖造成斩击伤害。",
    tags: ["攻击", "克藤", "需书写"],
    preview: "斩击预览",
    action: "确认书写",
    spiritCost: 8,
    basePower: 46,
    target: "enemy",
    effect: "damage",
    requiresWriting: true,
    previewVisible: true,
  },
];

const gradeLabels = {
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

const cards = document.querySelectorAll(".skill-card");
const characterCards = document.querySelectorAll(".status-card");
const chapter = document.querySelector(".chapter");
const objective = document.querySelector(".objective");
const infoTitle = document.querySelector(".info-title");
const infoText = document.querySelector(".info-text");
const infoTags = document.querySelector(".info-tags");
const castButton = document.querySelector(".cast-button");
const previewLabel = document.querySelector(".preview-label");
const previewLayer = document.querySelector(".preview-layer");
const saveButton = document.querySelector(".save-button");
const loadButton = document.querySelector(".load-button");
const saveStatus = document.querySelector(".save-status");
const combatLog = document.querySelector(".combat-log");
const enemyPanel = document.querySelector(".enemy-panel");
const mentorBubble = document.querySelector(".mentor-bubble");
const mentorLine = mentorBubble?.querySelector("p");
const writingGuide = document.querySelector(".writing-guide");

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

const mentorSkillTips = {
  dao: "先从「一」试起：选字牌后点开始书写，照着淡墨横线稳稳走完一笔。",
  zhan: "「刀」是主攻字。笔画越贴近字形，斩击越重，专破霜藤妖的妖躯。",
  jing: "「人」可温养自身。写得过半，回血之外还能净化寒蚀与恐惧。",
  ding: "「止」能封住妖势。书写威力达到50%，霜藤妖就会跳过一次反击。",
};

const writingGuides = {
  dao: "一横求稳不求快：贴着淡墨横线走，少抖、少偏、不要反复涂厚。",
  zhan: "写「刀」时先顾字形，再顾速度。覆盖淡墨笔画，同时别把空白处涂满。",
  jing: "写「人」要让两笔立住。贴合淡墨，空处留白，笔力才会回到自己身上。",
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gradeText(entity) {
  return `${gradeLabels[entity.grade] || `${entity.grade}品`} · ${entity.realm}`;
}

function percent(current, max) {
  if (!max) return 0;
  return clamp((current / max) * 100, 0, 100);
}

function setSaveStatus(message) {
  saveStatus.textContent = `存档：${message}`;
}

function setLog(message) {
  combatLog.textContent = `战斗记录：${message}`;
}

function setMentorTip(message, tone = 'guide', appendVoice = false) {
  if (!mentorBubble || !mentorLine) return;
  mentorLine.textContent = message;
  speak(message, 'mentor', { interrupt: !appendVoice, deduplicate: true });
  mentorBubble.classList.remove('guide', 'praise', 'warn');
  mentorBubble.classList.add(tone);
  mentorBubble.style.animation = 'none';
  void mentorBubble.offsetWidth;
  mentorBubble.style.animation = '';
}

function setWritingGuide(skill) {
  if (!writingGuide) return;
  writingGuide.textContent = `${writingGuides[skill.id] || '沿淡墨字形下笔，尽量覆盖该覆盖的笔画，避开空白处。'} 覆盖率和准确率都达到90%，就会判定为完美书写。`;
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
}

function renderBattleMeta() {
  chapter.textContent = battleState.chapter;
  objective.textContent = battleState.objective;
  document.querySelector('#turn-label').textContent = battleEnded ? '战斗结束' : `第 ${battleState.turn.round} 回合 · ${battleState.turn.side === 'player' ? '我方行动' : '敌方行动'}`;
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

function showSkillInfo(skillId = selectedSkill) {
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
  castButton.textContent = canCast ? (skill.requiresWriting ? '开始书写' : '释放墨刀') : reason;
  castButton.disabled = !canCast;
  previewLabel.textContent = skill.effect === 'damage' ? `预计伤害 ${skill.requiresWriting ? '0–' : ''}${calculateDamage(actor, skill)}` : skill.effect === 'control' ? '威力≥50% · 定身一回合' : `净化目标：${actor.name}`;
  previewLayer.classList.toggle("hidden", !skill.previewVisible);
  document.querySelector('.enemy').classList.toggle('targeted', skill.target === 'enemy' && !battleEnded);
  if (battleState.turn.side === 'player' && !battleEnded && !writingDialog.open) {
    setMentorTip(mentorSkillTips[skill.id] || "先看汉字牌的效果，再选择施法者。精神足够时，就可以开始书写。", 'guide', true);
  }
}

function selectSkill(skillId) {
  const skill = skillData[skillId];
  if (!skill) return;
  selectedSkill = skillId;

  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.skill === skillId);
    card.setAttribute('aria-pressed', String(card.dataset.skill === skillId));
  });
  showSkillInfo(skillId);
}

function selectCharacter(characterId) {
  if (battleEnded || battleState.turn.side !== 'player') return;
  if (!battleState.party.some((member) => member.id === characterId)) return;
  selectedCharacter = characterId;
  renderCharacters();
  showSkillInfo();
}

function calculateDamage(actor, skill) {
  const rawDamage = skill.basePower + actor.attack - battleState.enemy.defense;
  return Math.max(1, Math.round(rawDamage));
}

function applySkill(writingScore = null) {
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
    writingPending = { actorId: actor.id, skillId: selectedSkill };
    document.querySelector('#writing-title').textContent = `书写 · ${skill.char}`;
    resetWriting(skill.char);
    setWritingGuide(skill);
    setMentorTip("看淡墨底字落笔：覆盖该有的笔画，避开空白。覆盖与准确双过90%，便是完美。");
    writingDialog.showModal();
    startWritingTimer();
    return;
  }
  const power = skill.requiresWriting ? writingScore.power : 1;
  actor.spirit = clamp(actor.spirit - skill.spiritCost, 0, actor.maxSpirit);
  if (writingScore?.tier) showWritingFeedback(writingScore, skill, actor);

  if (power === 0) {
    setLog(`${actor.name} 的「${skill.char}」未能成形，施法失败。`);
  } else if (skill.effect === "damage") {
    const damage = Math.round(calculateDamage(actor, skill) * power);
    battleState.enemy.hp = clamp(battleState.enemy.hp - damage, 0, battleState.enemy.maxHp);
    setLog(`${actor.name} 释放「${skill.char}」，霜藤妖受到 ${damage} 点伤害。`);
    feedback('enemy', `-${damage}`);
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
    feedback(actor.id, `+${heal}`);
  }

  const sprite = document.querySelector(actor.id === 'shen_yan' ? '.hero' : '.mentor');
  sprite.classList.remove('acting');
  void sprite.offsetWidth;
  sprite.classList.add('acting');
  if (writingScore?.tier) combatLog.textContent += ` 书写 ${Math.round(writingScore.score * 100)} 分，威力 ${Math.round(power * 100)}%。`;
  checkOutcome();
  if (!battleEnded) beginEnemyTurn(actor.id);
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
    version: 2,
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
  if (save?.battleState) {
    battleState = clone(save.battleState);
  }
  selectedCharacter = save?.selectedCharacter || battleState.party[0].id;
  selectedSkill = save?.selectedSkill || battleState.selectedSkill || "zhan";
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
  card.addEventListener("click", () => selectSkill(card.dataset.skill));
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
  setInterval(tickBattle, 100);
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

function checkOutcome() {
  if (battleEnded || !battleState) return;
  const win = battleState.enemy.hp <= 0;
  if (!win && battleState.party.some(member => member.hp > 0)) return;
  battleEnded = true;
  writingDialog.close();
  menuDialog.close();
  document.querySelector('#result-title').textContent = win ? '妖邪已退' : '力竭倒下';
  document.querySelector('#result-text').textContent = win ? '雪林暂安，此战告捷。' : '霜藤封路，整装再战。';
  resultDialog.showModal();
}

function normalizeBattle() {
  for (const entity of [...battleState.party, battleState.enemy]) delete entity.action;
  battleState.turn ||= { side: 'player', round: 1, skipEnemy: false, targetId: null };
  enemyDelay = 0;
  lastTick = performance.now();
}

function beginEnemyTurn(targetId) {
  battleState.turn.side = 'enemy';
  battleState.turn.targetId = targetId;
  enemyDelay = 0;
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
  context.drawImage(ink, 0, 0);
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
  if (!hasInk) {
    setLog('书写时间已到，尚未落笔，请重新选招。');
    setMentorTip("未落笔不会消耗精神。下一次先稳住呼吸，再从淡墨最清楚的一笔开始。", 'warn');
    return;
  }
  const pixels = inkContext.getImageData(0, 0, 400, 400).data;
  const score = scoreWriting(templateMask, pixels);
  selectedCharacter = pending.actorId;
  selectedSkill = pending.skillId;
  applySkill(score);
}

function showWritingFeedback(result, skill, actor) {
  speak(skill.char, actor.id === 'shen_yan' ? 'hero' : 'mentor', { interrupt: true });
  const field = document.querySelector('.battlefield');
  field.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  field.querySelectorAll('.writing-verdict, .enemy-taunt, .ink-burst').forEach(node => node.remove());
  const coverage = Math.round(result.coverage * 100);
  const precision = Math.round(result.precision * 100);
  const verdict = document.createElement('div');
  verdict.className = `writing-verdict ${result.tier}`;
  const title = document.createElement('strong');
  title.textContent = `${({ perfect: '神完气足', good: '笔力遒劲', normal: '初具字形', weak: '笔力微弱', flooded: '墨乱神散' })[result.tier]} · ${Math.round(result.score * 100)}分`;
  const detail = document.createElement('span');
  detail.textContent = `覆盖 ${coverage}% · 准确 ${precision}% · 威力 ${Math.round(result.power * 100)}%`;
  verdict.append(title, detail);
  field.append(verdict);
  setTimeout(() => verdict.remove(), 4200);
  if (result.tier === 'perfect') {
    setMentorTip(`好字！覆盖 ${coverage}%、准确 ${precision}%，双过90%，这一击便是完美书写。`, 'praise', true);
  } else if (result.tier === 'flooded') {
    setMentorTip(`墨铺得太满，空白也被吞了。宁可少写一分，也别把画布涂成一团。`, 'warn', true);
  } else if (result.tier === 'weak') {
    setMentorTip(`笔画偏得多了些。先追淡墨的骨架，覆盖上去，再谈速度。`, 'warn', true);
  } else if (result.power >= .5) {
    setMentorTip(`已能成招。想要完美，就让覆盖和准确同时到90%以上。`, 'guide', true);
  } else {
    setMentorTip(`字形已起，但笔力还浅。少写空白，多贴淡墨，威力会立刻上来。`, 'guide', true);
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
    const burst = document.createElement('div');
    burst.className = `ink-burst ${result.tier}`;
    burst.style.left = actor.id === 'shen_yan' ? '25%' : '12%';
    burst.textContent = skill.char;
    field.append(burst);
    if (result.tier === 'perfect') {
      for (let i = 0; i < 18; i++) {
        const drop = document.createElement('i');
        drop.style.setProperty('--dx', `${Math.cos(i * 2.4) * (70 + i * 4)}px`);
        drop.style.setProperty('--dy', `${Math.sin(i * 2.4) * (40 + i * 3)}px`);
        burst.append(drop);
      }
    }
    setTimeout(() => burst.remove(), 1100);
  }
}
document.querySelector('#submit-writing').addEventListener('click', () => finishWriting('button'));
writingDialog.addEventListener('close', () => {
  if (!writingDialog.open) { stopWriting(); writingPending = null; }
});
document.addEventListener('visibilitychange', updateWritingTimer);
document.querySelector('.pause-button').addEventListener('click', () => menuDialog.showModal());
document.querySelector('#resume-battle').addEventListener('click', () => menuDialog.close());
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
});
resultDialog.addEventListener('cancel', event => event.preventDefault());

restButton.addEventListener('click', () => {
  const actor = getActor();
  if (battleEnded || battleState.turn.side !== 'player' || actor.hp <= 0) return;
  const restored = Math.min(20, actor.maxSpirit - actor.spirit);
  actor.spirit += restored;
  setLog(`${actor.name} 调息，恢复 ${Math.floor(restored)} 点精神。`);
  setMentorTip("调息也算一次行动。精神不足时可用，但要准备承受妖物反击。");
  beginEnemyTurn(actor.id);
  renderAll();
  showSkillInfo();
});

init().catch(() => { setLog('战斗数据加载失败，请刷新重试。'); castButton.disabled = true; });
