# 杀伐字卡画谱

星级控制外框与卡背，技能题材控制正面画意。刀卡不再沿用钟鼎或山水通用背景；费用、品质、墨迹与等级不变。

| 资源 | 构图 | 接入范围 |
| --- | --- | --- |
| martial-battlefield.png | 古战场、兵刃、战旗与远山 | 长者「借刀断藤」 |
| martial-bamboo-blades.png | 竹林、刀剑、石径与远处侠影 | 玩家「松烟斩势」 |
| martial-night-swordsman.png | 月夜屋瓦、孤侠、雨丝与灯火 | 画谱储备 |

三张为内置 imagegen 独立生成的完整原画，保存在 src/assets/cards/。保留水墨、矿物设色和绢纸质感，中间雾色方便叠放玩家亲笔字；避免血腥与西式奇幻铠甲。长者卡取战场的厚重感，自制刀卡取竹林的轻巧笔势。

技能配置的 faceArt 决定正面原画。手牌、牌册墨迹预览和成卡正面都使用同一资源；翻牌卡背仍按星级呈现。菜单卡纹图鉴增加三个题材入口，一屏查看；画谱储备不意味着增加了新技能。另尝试剑关山河主题，生成未返回，未保存或接入资源。

## 最终生成提示

### 古战场

Production vertical 2:3 full-bleed collectible card illustration, Chinese traditional ink painting with restrained mineral colors on aged silk. Ancient battlefield after a clash, dramatic diagonal long dao saber and broken spear planted among stones foreground, weathered banners, distant silhouettes of armored warriors and horses in mist, layered mountains, drifting dust. Evocative martial atmosphere without gore. Slate ink grey, oxidized bronze, sparse cinnabar. Rich complete image from top to bottom, carefully drawn weapons, classical Chinese art NOT photorealistic nor western fantasy. Middle central area light mist suitable for a player's large black handwritten glyph overlay, meaningful illustration across entire card not just border ornaments. No text, no frame, no UI, no letters. Opaque full background.

### 竹林双刃

Production vertical 2:3 full-bleed collectible card illustration. Ancient Chinese wuxia bamboo grove in fine brush and ink wash on silk, two elegant steel weapons a curved dao and a straight jian leaning diagonally against an old mossy rock in foreground, jade bamboo trunks rise full height, fallen bamboo leaves, narrow stone path vanishes into mist, distant small cloaked swordsman silhouette. Sophisticated guohua painting, deep malachite jade, pale grey mist, silver blades, small vermilion sword tassel. Dynamic diagonal blades but naturally plausible geometry. Rich image covering the entire canvas, with light mist at central area to allow overlaid black calligraphy. No text, no frame, no UI, no letters. Opaque full background.

### 月夜侠客

Production vertical 2:3 full-bleed collectible card illustration, elegant Chinese ink painting and fine brush on silk. A solitary ancient Chinese wandering swordsman in dark indigo robes, small full-body figure in lower left, one hand resting on a sheathed jian, standing on old stone roof tiles overlooking a misty riverside town, full moon upper right, bamboo shadows, rain threads, distant lanterns. Poetic wuxia assassin atmosphere, quiet resolve rather than exaggerated combat, silver moon, dark blue ink, muted crimson lanterns. Entire image is a rich complete scene, pale mist in central region for overlaid handwritten black glyph, not a character portrait that dominates the center. No gore. No text, no frame, no UI, no letters. Opaque full background.
