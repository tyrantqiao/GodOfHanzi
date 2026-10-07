# Agents Guide

## 当前方向（爬塔原型）

当前主入口已改为汉字卡牌构筑 Roguelike，暂停剧情章节开发。以 `docs/system/tower-design.md` 为当前玩法与排期依据；下文旧战斗与剧情说明仅适用于保留的旧入口。

- `index.html` / `src/tower.js` / `src/tower.css`：九层爬塔界面。
- `src/tower-core.js`：DOM 无关的路线、抽牌、战斗、奖励、休息与存档重放；测试 `src/tower-core.test.js` 已加入 `npm test`。
- `data/tower.json`：23张字卡、17种术式、6件遗物、敌人、路线与数值。组合纯规则在 `src/tower-combos.js`，资产在 `src/assets/tower/`，目录在 `docs/content/tower-card-catalog.md`。
- `data/tower-events.json`：30个奇遇；规则 `src/tower-events.js`，亲笔字谱与纯评分 `src/tower-craft.js`，测试 `src/tower-events.test.js`。新局只有刀×5、盾×5；强力字卡从奇遇获取，无高级开局预设。
- `tutorial.html`：原制卡教学；`legacy.html`：旧版书写战斗。保留已有制卡资产；爬塔已接入奇遇制卡，见 `src/tower-craft.js`。
- 新爬塔存档为 `mode: tower, version: 3, contentVersion: tower-3.0`，通过种子和合法操作记录重放；`version: 2` 使用 `data/tower-v2.json` / `src/tower-core-v2.js`，原 `version: 1` 使用 `data/tower-v1.json` / `src/tower-core-v1.js` 冻结规则继续。本地使用 `hanzi-tower-save`。服务端 `/api/save` 仍为共用单槽，加载时按模式检查，模式不符回退对应本地存档。
- 验证路线选择、火刀联动、格挡清空、弃牌洗回、奖励跳过、休息与强化、败北/登顶及存档恢复。不要把剧情演出重新设为爬塔前置流程。

This repository is 《汉字成圣》(God of Hanzi): a web-based 2D side-view turn-based battle prototype where Chinese characters are combat skills. Gameplay is driven by tracing the character on a canvas — writing accuracy determines skill power. Use this file as the first stop for future LLM/code-agent work in this repo.

## Project Map

- Entry page: `index.html` (battle UI markup + `<script type="module" src="src/main.js">`). No build step; the browser loads ES modules directly.
- `src/main.js`: all game logic — battle state, turn flow, skill cards, writing canvas and brush engine, save/load wiring, enemy feedback. Largest source file (~940 lines).
- `src/battle.js`: pure combat math and battle-state helpers (`clamp`, `percent`, `gradeText`, `calculateDamage`, `normalizeBattleState`, `getBattleResult`), kept DOM-free so they can be unit-tested.
- `src/writing-score.js`: pure scoring function (`scoreWriting`), no DOM dependencies.
- `src/storage.js`: localStorage + `/api/save` client helpers.
- `src/voice.js`: browser-side voice playback (Web Audio, queue, `/api/voice` client).
- `src/styles.css`, `src/characters.css`: HUD/battlefield styling and character/sprite animations.
- `src/assets/`: AI-generated art (background `backgrounds/snow-ink-battlefield.png`, character sprites in `characters/`).
- `server.js`: zero-dependency Node static server + API (save/load, voice). Exposes `createAppServer({ rootDir, port })` and `isBlocked(relative)`; only starts listening when run directly. Also the dev server.
- `voice-service.js` / `voice-worker.js`: local Kokoro TTS via `sherpa-onnx-node`, running in a worker thread with on-disk WAV caching.
- `scripts/warm-voices.js`: pre-generates common dialogue audio into the cache.
- `data/`: game data and persistence (see Data Files below).
- `docs/`: design documents — `game-design-document.md` (GDD v0.2), `system/system-design.md`, `system/ui-design-proposal.md`, `content/*-skill-catalog.md`, `narrative/*` story drafts, `local-voice.md` (TTS setup guide).
- `models/`: TTS model files, git-ignored, downloaded manually (see Voice Notes).
- Tests: `src/writing-score.test.js`, `src/battle.test.js`, `voice-service.test.js`, `server.test.js`, run with Node's built-in test runner.
- `.gitignore` excludes `node_modules/`, `models/`, `data/voice-cache/`.

## Common Commands

Run from the repository root.

```bash
npm install          # or npm ci (only dependency: sherpa-onnx-node)
npm run dev          # node server.js → http://localhost:5173
npm test             # node --test src/writing-score.test.js src/battle.test.js voice-service.test.js server.test.js
npm run voice:warm   # pre-synthesize dialogue WAVs (requires models/ present)
```

Keep new runtime logic split so the testable core stays DOM-free: pure math/state helpers belong in modules like `src/battle.js` / `src/writing-score.js` (imported by `src/main.js`), and the server stays testable through `createAppServer` with an injected `rootDir`. Add a matching `*.test.js` and list it in the `test` script when you extract more logic.

Port defaults to 5173; override with `PORT=... node server.js`. No bundler, no framework, no lint config. The README states the intent: native HTML/CSS/JS prototype first, later migration to Vite/React/Phaser is acceptable but not started.

## Architecture Notes

### Server (`server.js`)

- Serves static files from the repo root with a small MIME map; `Cache-Control: no-store` on everything.
- API routes: `GET/POST /api/save`, `GET /api/voice/status`, `POST /api/voice` (returns `audio/wav`).
- Static serving has a denylist: `models`, `node_modules`, `.git`, `data/voice-cache` and the server-side files (`server.js`, `voice-service.js`, `voice-worker.js`) return 403. Keep this denylist intact when refactoring `serveStatic`.
- Request body is capped at 1 MB.

### Voice stack

- `voice-service.js` checks for required model files under `models/kokoro-multi-lang-v1_1` (or `TTS_MODEL_DIR`); if missing, the game still runs silently and `/api/voice` returns 503 with a status message. Missing models are a normal dev state, not an error to "fix".
- Synthesis runs in `voice-worker.js` (worker thread, CPU). Results cache to `data/voice-cache/<sha256>.wav`; cache key includes `CACHE_VERSION` — bump it when replacing model files.
- `normalizeSpeechText` converts percentages to spoken Chinese and strips unsupported punctuation; there are dedicated tests for it. Change it carefully.
- Roles `hero`/`mentor`/`enemy` map to fixed speaker IDs and speeds in `voice-service.js`. Max 220 chars per request, max 12 concurrent pending jobs.
- Client (`src/voice.js`) requires a user gesture to unlock AudioContext and queues playback; audio is never autoplayed.

### Frontend (`src/main.js`)

- Battle state shape comes from `data/battle-state.json`; skills from `data/hanzi-skills.json` (a `fallbackSkills` copy exists in main.js as a load-failure fallback — keep both in sync when editing skill schema).
- Turn flow is strict alternation: player acts once → enemy counters once (`beginEnemyTurn` / `tickBattle`, ~0.9s delay, driven by a 100 ms interval). Selecting a card, opening the writing dialog, or pausing must not trigger enemy attacks.
- `tickBattle` early-returns while dialogs are open or the document is hidden; preserve these guards when adding timers/animations.
- Saving during the enemy turn persists the pending counterattack (`turn.skipEnemy`, `turn.targetId`) — load must resume it.
- UI updates are imperative DOM manipulation via `querySelector` against the ids/classes defined in `index.html`; there is no component system. Rendering entry points: `renderAll`, `renderCharacters`, `renderEnemy`, `renderBattleMeta`, `showSkillInfo`.
- Accessibility matters in this prototype: `aria-live` regions, `aria-pressed` on cards, keyboard handlers on character cards. Keep them when touching interaction code.

### Writing/scoring mechanic

- The writing dialog renders a 400×400 canvas: dashed 米字格 guides, faint glyph template (KaiTi 300px; special-case stroke drawing for 「一」), plus an ink layer.
- The brush engine simulates pressure (velocity-derived when no pen input), corner blooming, hold-bloom, and start/end taper. Strokes are stored in `brushStrokes` and re-rendered wholesale via `renderInk`; keep scoring pixel-compatible (alpha channel sampled every 4th byte).
- `scoreWriting` (pure function) computes coverage/precision from the template mask vs. ink pixels; tiers: `perfect` (both ≥90% → power 1), `flooded` (fill ≥65% and precision <55% → power 0, casting fails but spirit is still spent), `weak` (score <20%), `good` (≥65%), `normal`. Power = coverage × precision otherwise. Control/cleanse effects require power ≥50%.
- 30-second writing timer: finishing via submit button, dragging the pen outside the canvas, or timeout all end the session; rewriting does not reset the timer; blank timeout returns without spending spirit. These behaviors are deliberate — do not "simplify" them away.
- Fail feedback includes enemy taunts (`weak`/`flooded`) and teacher (mentor) tips per skill stored in `mentorSkillTips` / `writingGuides`.

## Data Files

```text
data/
  battle-state.json      initial combat state (party + enemy + chapter/objective)
  hanzi-skills.json      skill definitions: id, char, title, text, tags, spiritCost,
                         basePower, target, effect, requiresWriting, previewVisible
  default-save.json      fallback save served when no player save exists
  save.local.json        player save written by the server; generated on first save
  voice-cache/           generated WAV cache; git-ignored, safe to delete
```

- Save payload is versioned (`version: 2` in `buildSavePayload`); old fields like action bars are stripped by `normalizeBattle` on load. If you change save shape, bump the version and keep load-time migration.
- Save is dual-target: always writes localStorage (`hanzi-saint-save`), and additionally `POST /api/save` when the local server runs. Load prefers server save, falls back to localStorage. Keep both paths working — the prototype must run from plain `python -m http.server`-style static hosting too.
- Skill effects implemented today: `damage`, `cleanse` (heal + purge 寒蚀/恐惧 + suppress 狂暴), `control` (定身, skips one enemy counter). 调息/rest is a hard-coded action in main.js, not a skill entry.

## Voice Model Setup (optional)

Only needed for TTS testing; the game runs without it.

1. Download `kokoro-multi-lang-v1_1.tar.bz2` from sherpa-onnx releases and extract so that `models/kokoro-multi-lang-v1_1/model.onnx` exists.
2. Full instructions (Windows/Linux, `TTS_MODEL_DIR`, `LD_LIBRARY_PATH`): see `docs/local-voice.md`.
3. Do not commit `models/` or `data/voice-cache/`. Preserve license notices when packaging.

## Git Hooks

- A pre-commit hook lives at `.githooks/pre-commit`; it runs `npm test` and aborts the commit if any test fails.
- It is wired with Git's native hooks path (`core.hooksPath = .githooks`), not Husky, to stay dependency-free. The root `prepare` npm script sets this automatically after `npm install`; a repo already configured (this clone) can be wired manually with `git config core.hooksPath .githooks` or `npm run prepare`.
- Agents: do NOT bypass the hook with `git commit --no-verify` unless the user explicitly accepts the risk. If a commit is blocked, fix the failing tests first.

## Validation Checklist

For most changes:

```bash
npm test
```

Then, since there is no automated UI test, verify in the browser (`npm run dev`):

1. Skill card selection updates info panel, preview label, and cost tags.
2. A full player→enemy round: cast 「一」/「刀」 (damage), 「人」 (heal/cleanse), 「止」 (control), and 调息; confirm turn label, floating numbers, and combat log.
3. Writing flow: perfect, weak, flooded, and timeout paths; confirm power scaling, taunts, and mentor tips.
4. Save during enemy turn, reload, and load: confirm battle state, pending counterattack, and selection restore (both server and localStorage paths).
5. Voice (if models installed): toggle in pause menu, preview, status messages; without models confirm graceful degradation.
6. Static-hosting fallback: open via server and check 403 denylist still blocks `models/`, `node_modules/`, `server.js`.

## Agent Safety Rules

- Plain ES modules everywhere (`"type": "module"` in `package.json`); all relative imports include the `.js` extension in both browser and Node code. Keep that convention.
- Do not introduce a framework, bundler, or new dependency without explicit user request; the dependency-free prototype setup is intentional.
- UI text, comments, docs, and log messages are Chinese; keep them Chinese and match existing tone (修仙/水墨 stylization).
- Game balance lives in `data/*.json`; prefer tuning there over hard-coding numbers in `src/main.js` (exception: rest amount and timer durations currently live in main.js).
- Never edit `data/save.local.json` or `data/voice-cache/` by hand as part of feature work; they are runtime artifacts.
- Do not remove the 403 denylist, request body cap, or voice input validation when touching `server.js` / `voice-service.js`.
- When changing scoring thresholds, update `src/writing-score.test.js` and the README rules summary together.
- `docs/` contains the design source of truth; check GDD and system-design before adding new mechanics, and keep content catalogs in sync with `hanzi-skills.json` when skills change.
- Do not commit, push, or deploy unless explicitly asked.
