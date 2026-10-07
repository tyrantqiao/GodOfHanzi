# 爬塔资产清单 v0.3

当前55份本地可编辑SVG：23张字卡、17个术式、6件遗物、3种敌人轮廓与6类奇遇场景画意。沿用墨青、草绿、朱砂与旧金；新盾牌有明确盾形，新奇遇画意分别是酒盏／试卷／灯笺／山道／纸笔／剑云。亲笔卡面额外绘制玩家实际笔迹。

资产由原生脚本绘制，无新增依赖、外部素材或图片生成调用。原PNG插画和旧教学资产保留。重建：npm run tower:assets（generate-tower-assets.js 与 generate-encounter-assets.js）。目录再生：npm run tower:catalogs。

| 内容 | 资产 |
| --- | --- |
| 斩势 | src/assets/tower/blade.svg |
| 固守 | src/assets/tower/guard.svg |
| 引燃 | src/assets/tower/fire.svg |
| 调序 | src/assets/tower/draw.svg |
| 压制 | src/assets/tower/stop.svg |
| 断岳 | src/assets/tower/heavy.svg |
| 炽焰 | src/assets/tower/flame.svg |
| 余烬 | src/assets/tower/ember.svg |
| 护烬 | src/assets/tower/ash.svg |
| 守势 | src/assets/tower/hold.svg |
| 震岳 | src/assets/tower/quake.svg |
| 磐石 | src/assets/tower/rock.svg |
| 聚势 | src/assets/tower/gather.svg |
| 藏锋 | src/assets/tower/hide.svg |
| 破军 | src/assets/tower/break.svg |
| 引卷 | src/assets/tower/guide.svg |
| 换墨 | src/assets/tower/exchange.svg |
| 定心 | src/assets/tower/steady.svg |
| 凝气 | src/assets/tower/qi.svg |
| 回旋 | src/assets/tower/spin.svg |
| 御风 | src/assets/tower/wind.svg |
| 润墨 | src/assets/tower/water.svg |
| 护身 | src/assets/tower/shield.svg |
| 两仪焰莲 | src/assets/tower/skill-lotus.svg |
| 双炬 | src/assets/tower/skill-twin.svg |
| 封山印 | src/assets/tower/skill-seal.svg |
| 镇岳波 | src/assets/tower/skill-wave.svg |
| 藏锋斩 | src/assets/tower/skill-hiddenSlash.svg |
| 熔岩甲 | src/assets/tower/skill-lava.svg |
| 悬刃卫 | src/assets/tower/skill-bladeWard.svg |
| 调息印 | src/assets/tower/skill-breath.svg |
| 气旋丸 | src/assets/tower/skill-orb.svg |
| 风轮刃 | src/assets/tower/skill-windBlade.svg |
| 赤焰丸 | src/assets/tower/skill-fireOrb.svg |
| 镇岳丸 | src/assets/tower/skill-mountainOrb.svg |
| 焰风轮 | src/assets/tower/skill-flameWheel.svg |
| 回旋刃 | src/assets/tower/skill-boomerang.svg |
| 焰旋 | src/assets/tower/skill-fireSpin.svg |
| 涡流 | src/assets/tower/skill-vortex.svg |
| 雾幕 | src/assets/tower/skill-mist.svg |
| 朱砂砚 | src/assets/tower/relic-cinnabar.svg |
| 余烬灯 | src/assets/tower/relic-emberLamp.svg |
| 镇纸 | src/assets/tower/relic-paperweight.svg |
| 碑拓 | src/assets/tower/relic-rubbing.svg |
| 藏锋匣 | src/assets/tower/relic-bladeCase.svg |
| 旧书签 | src/assets/tower/relic-bookmark.svg |
| 霜藤妖 | src/assets/characters/frost-vine.png |
| 寒墨妖 | src/assets/tower/enemy-ink.svg |
| 碑蛀 | src/assets/tower/enemy-beetle.svg |
| 镇塔墨魇 | src/assets/tower/enemy-ink.svg |
| 裂碑巨像 | src/assets/tower/enemy-colossus.svg |
| 古人对话 | src/assets/tower/events/dialogue.svg |
| 答题闯关 | src/assets/tower/events/quiz.svg |
| 原创挽词 | src/assets/tower/events/lament.svg |
| 奇景冒险 | src/assets/tower/events/adventure.svg |
| 借笔制卡 | src/assets/tower/events/craft.svg |
| 小说彩蛋 | src/assets/tower/events/cameo.svg |

当前验证包括82项自动测试、48局完整重放，以及浏览器中李白选项→亲笔写火→强化卡入册的实际操作。模拟策略不是人类胜率结论。实机图：images/tower-encounter-preview.png、images/tower-event-craft-preview.png。
