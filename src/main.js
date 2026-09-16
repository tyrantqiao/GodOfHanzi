import { loadLocalSave, loadServerSave, saveLocal, saveServer } from "./storage.js";

const fallbackSkills = [
  {
    id: "zhan",
    char: "斩",
    title: "一字斩",
    text: "凝字为刃，对霜藤妖造成斩击伤害。克制藤蔓，命中后小幅击退行动条。",
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

let skillData = {};
let battleState = null;
let selectedSkill = "zhan";
let selectedCharacter = "shen_yan";
let infoMode = "skill";

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

function getActor(id = selectedCharacter) {
  return battleState.party.find((member) => member.id === id) || battleState.party[0];
}

function renderBar(container, current, max) {
  const fill = container.querySelector("span");
  const label = container.querySelector("strong");
  fill.style.width = `${percent(current, max)}%`;
  label.textContent = `${current}/${max}`;
}

function renderCharacters() {
  battleState.party.forEach((member) => {
    const card = document.querySelector(`[data-character="${member.id}"]`);
    if (!card) return;

    card.classList.toggle("active", member.id === selectedCharacter);
    card.querySelector(".character-name").textContent = member.name;
    card.querySelector(".character-realm").textContent = gradeText(member);
    renderBar(card.querySelector(".bar.hp"), member.hp, member.maxHp);
    renderBar(card.querySelector(".bar.spirit"), member.spirit, member.maxSpirit);

    const icons = card.querySelector(".status-icons");
    icons.replaceChildren(
      ...member.states.map((state) => {
        const icon = document.createElement("i");
        icon.textContent = state;
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
  const canCast = actor.spirit >= skill.spiritCost;
  infoMode = "skill";

  infoTitle.textContent = skill.title;
  infoText.textContent = `${skill.text} 消耗精神 ${skill.spiritCost}，基础威力 ${skill.basePower}。施法者：${actor.name}。`;
  renderTags([...skill.tags, canCast ? "可释放" : "精神不足"]);
  castButton.textContent = canCast ? skill.action : "精神不足";
  castButton.disabled = !canCast;
  previewLabel.textContent = skill.preview;
  previewLayer.classList.toggle("hidden", !skill.previewVisible);
}

function showCharacterInfo(characterId) {
  const member = getActor(characterId);
  infoMode = "character";
  infoTitle.textContent = `${member.name} · ${member.role}`;
  infoText.textContent = `${gradeText(member)}，等级 ${member.level}。生命 ${member.hp}/${member.maxHp}，精神 ${member.spirit}/${member.maxSpirit}，攻击 ${member.attack}，防御 ${member.defense}，行动条 ${member.action}%。`;
  renderTags(member.states.length ? member.states : ["无状态"]);
  castButton.textContent = "返回技能";
  castButton.disabled = false;
  previewLayer.classList.add("hidden");
}

function selectSkill(skillId) {
  const skill = skillData[skillId];
  if (!skill) return;
  selectedSkill = skillId;

  cards.forEach((card) => {
    card.classList.toggle("selected", card.dataset.skill === skillId);
  });
  showSkillInfo(skillId);
}

function selectCharacter(characterId) {
  if (!battleState.party.some((member) => member.id === characterId)) return;
  selectedCharacter = characterId;
  renderCharacters();
  showCharacterInfo(characterId);
}

function calculateDamage(actor, skill) {
  const rawDamage = skill.basePower + actor.attack - battleState.enemy.defense;
  const writingBonus = skill.requiresWriting ? 1.08 : 1;
  return Math.max(1, Math.round(rawDamage * writingBonus));
}

function applySkill() {
  if (infoMode === "character") {
    showSkillInfo();
    return;
  }

  const skill = skillData[selectedSkill];
  const actor = getActor();
  if (!skill || !actor || actor.spirit < skill.spiritCost) {
    showSkillInfo();
    return;
  }

  actor.spirit = clamp(actor.spirit - skill.spiritCost, 0, actor.maxSpirit);
  actor.action = 0;

  if (skill.effect === "damage") {
    const damage = calculateDamage(actor, skill);
    battleState.enemy.hp = clamp(battleState.enemy.hp - damage, 0, battleState.enemy.maxHp);
    battleState.enemy.action = clamp(battleState.enemy.action - 12, 0, 100);
    setLog(`${actor.name} 释放「${skill.char}」，霜藤妖受到 ${damage} 点伤害。`);
  }

  if (skill.effect === "control") {
    battleState.enemy.action = clamp(battleState.enemy.action - skill.basePower, 0, 100);
    if (!battleState.enemy.states.includes("定")) {
      battleState.enemy.states.push("定");
    }
    setLog(`${actor.name} 写下「${skill.char}」，霜藤妖行动条下降 ${skill.basePower}。`);
  }

  if (skill.effect === "cleanse") {
    actor.hp = clamp(actor.hp + 8, 0, actor.maxHp);
    if (!actor.states.includes("静")) {
      actor.states.push("静");
    }
    battleState.enemy.states = battleState.enemy.states.filter((state) => state !== "狂暴");
    setLog(`${actor.name} 写下「${skill.char}」，心神稍定，狂暴被压下。`);
  }

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
    version: 1,
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
    setSaveStatus("已保存战斗数据到浏览器与 data/save.local.json");
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
  renderAll();
  selectSkill(selectedSkill);
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
  const localSave = loadLocalSave();
  if (localSave?.battleState) {
    battleState = clone(localSave.battleState);
    selectedCharacter = localSave.selectedCharacter || selectedCharacter;
    selectedSkill = localSave.selectedSkill || selectedSkill;
  } else {
    selectedSkill = battleState.selectedSkill || selectedSkill;
  }
  renderAll();
  selectSkill(selectedSkill);
}

init();
