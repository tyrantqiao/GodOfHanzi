# 满幅传统美术卡面

新版使用三幅原创满幅背景画，加七套独立题诗钤印和等级设色。游戏卡面、卡背、翻牌结果和卡纹图鉴统一使用新构图。

参考：[故宫千里江山图](https://intl.dpm.org.cn/Ceramics/518.html)、[故宫云雷纹释义](https://www.dpm.org.cn/lemmas/241368.html)、[国博青铜器艺术](https://www.chnmuseum.cn/zl/zlhg/201812/t20181220_32171.shtml)。吸收层叠山水、青绿设色、主题浮雕与繁密底纹的构图方法；作品是原创游戏美术，并非文物复刻或历史还原。

一星烟岚山水题王维《山居秋暝》，二星青绿江山题《汉江临泛》，三星钟鼎金石题原创「钟鼎传古意，金石记春秋」，四星宋词花笺题苏轼《水调歌头》，五星赤壁诗卷题《念奴娇·赤壁怀古》，六星金笺山河题杜甫《望岳》，七星星月诗画题《旅夜书怀》。

内置 imagegen 生成 art-landscape.png、art-bronze.png、art-poetry.png，保存在 src/assets/cards/。七等级共用三幅原画，通过题诗、设色与边框形成不同构图，并非七幅独立生成画。诗文用独立SVG准确排版；钟鼎仿铭文仅作装饰，不解释为真实古文字。原细线纹饰资源保留供对照。

卡背呈现较浓的完整画作，正面铺绢色与局部雾色提升亲笔字辨识。四至七星仅视觉预设。规则和存档不变。

## 最终生成提示

刀剑杀伐类的独立卡面扩展见 [杀伐字卡画谱](martial-card-art.md)，技能题材与星级卡背分别配置。

### landscape

Use case: stylized-concept. Production artwork for a vertical Chinese fantasy collectible card background, portrait 2:3. Full bleed ancient Chinese shanshui painting filling every part of the image, aged ivory silk texture. Rich Northern Song-inspired blue green mineral mountains, towering layered peaks, fine outlined ridges, pine groves, river winding through composition, tiny bridge, distant pavilion and mist. Sophisticated museum-quality guohua fine brush and ink washes, restrained malachite teal and azurite muted blue with tiny gold traces. Landscape runs from top to bottom, not small border icons, not blank central panel. Painterly atmospheric middle values so dark calligraphy can be overlaid later. No writing, no stamps, no text, no frame, no mockup. No game glyph, no UI. Opaque full image background.

### bronze

Use case: stylized-concept. Production artwork for a vertical Chinese fantasy collectible card back, portrait 2:3. Entire image filled with elegant ancient bronze ceremonial world: a magnificent central three-legged ding with upright handles and a bronze bell above it, archaic cast animal mask relief and densely nested squared cloud-thunder meanders spanning all edges, lower band of geometrical bronze inscriptions as abstract non-linguistic marks. Deep jade patina, aged burnished warm gold, dark bronze, relief casting texture, delicate turquoise inlay. Museum quality decorative artwork, strong symmetrical archaeological ritual composition, visually rich and regal, NOT a modern heraldic shield, not European filigree. Objects integrated into engraved bronze surface filling image, no empty background or center. No readable writing, no UI, no frame, no mockup. Opaque full image background.

### poetry

Use case: stylized-concept. Production artwork for a vertical Chinese poetry painting collectible card background, portrait 2:3. Full bleed Song dynasty poetic album page on beautifully aged cream handmade paper, full composition with ink bamboo branches spreading down one side, lotus pond, graceful plum branches and petals, moon in thin mist above water, small scholar pavilion in distance, broad diagonal folds of an unrolled ivory silk scroll traversing the center. Fine brush guohua flowers birds landscape, warm ivory with restrained aubergine ink, celadon and vermilion petals. Layered painted and paper surfaces fill the whole image. Leave visible open silk spaces within scroll for real typeset calligraphy to be overlaid later, but do not paint any text. Sophisticated poetic composition not a sparse decorative border. No text, no stamps, no UI, no mockup, no frame. Opaque full image background.
