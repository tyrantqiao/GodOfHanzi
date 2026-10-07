import fs from 'node:fs';

// 延续已有SVG资产：独立画意、材质与轮廓，可直接在静态页面使用。
const out = new URL('../src/assets/tower/', import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL('../data/tower.json', import.meta.url)));
fs.mkdirSync(out, { recursive: true });
const ridge = '<path d="M-20 210 55 105 106 158 163 57 228 142 274 92 382 205Z" fill="#344b47"/><path d="m110 155 53-98 35 82-30-22Z" fill="#9da89a"/><path d="M0 219 76 155 156 209 251 145 380 221Z" fill="#182e30"/>';
const blade = '<path d="M156 176 211 27 215 137 178 190Z" fill="#d5dfcf" stroke="#253f40" stroke-width="5"/><path d="m156 176-22 43 14 7 26-46" fill="#493c31"/><path d="m147 176 39 15" stroke="#c5ae75" stroke-width="8"/>';
const flame = '<path d="M181 191C88 170 117 115 135 97c-6 28 10 37 19 26 23-33-2-66 36-103-3 41 41 56 30 91 11-8 13-22 10-34 47 56 38 101-49 114Z" fill="#b85236" stroke="#ebbd70" stroke-width="2"/><path d="M183 185c-37-14-38-42-19-67 2 20 11 17 19-4 28 24 39 53 0 71Z" fill="#f0ce84"/>';
const orb = '<circle cx="180" cy="120" r="65" fill="url(#pearl)" stroke="#91beb4" stroke-width="3"/><g fill="none" stroke="#def0db" stroke-width="4"><path d="M134 100c30-49 103-4 88 36-13 36-73 17-62-16 9-26 46-7 31 10"/><path d="M126 143c57 39 122-24 87-68"/></g>';
const scroll = '<path d="M93 61h174l-12 133H78Z" fill="#d8c799" stroke="#6f735c" stroke-width="3"/><path d="M93 61c-24 0-23 21-3 23M255 194c28 0 29-23 5-24" fill="none" stroke="#9d865a" stroke-width="9"/><g stroke="#4c5a50" stroke-width="3"><path d="m119 98 104 2m-106 19 89 2m-91 21 105 1m-108 18 66 2"/></g>';
const swirl = '<g fill="none" stroke-linecap="round"><path d="M58 159c34-78 175-113 237-51 50 50-34 102-104 64-58-31-9-81 36-52" stroke="#d7d7b6" stroke-width="9"/><path d="M90 192c75 24 174-6 188-61M95 86c53-35 133-35 174-9" stroke="#95b7aa" stroke-width="4"/></g>';
const shield = '<path d="m180 43 65 26-8 82-57 52-57-52-8-82Z" fill="#4e695b" stroke="#c5c6a0" stroke-width="4"/><path d="m180 60 46 19-6 63-40 37-40-37-6-63Z" fill="none" stroke="#92a18b" stroke-width="2"/>';
const seal = '<rect x="124" y="65" width="112" height="112" rx="6" fill="#884331" stroke="#d8bd87" stroke-width="5"/><g stroke="#e2cda6" stroke-width="7" fill="none"><path d="M145 88h66v26h-46v40h47M145 110v47m23-67v66m39-17h-38"/></g>';
const ring = '<g fill="none" stroke="#c7b58a"><circle cx="180" cy="125" r="83" stroke-width="2"/><circle cx="180" cy="125" r="72" stroke-dasharray="14 7" stroke-width="3"/></g>';
const sparks = '<g fill="#ddb46d"><circle cx="80" cy="75" r="3"/><circle cx="275" cy="163" r="4"/><circle cx="116" cy="185" r="2"/><circle cx="240" cy="53" r="3"/></g>';
const lotus = '<g fill="#b74b37" stroke="#e5bb75" stroke-width="2"><path d="M180 170c-49-56-16-95 0-118 26 35 46 74 0 118Z"/><path d="M181 174c-55-6-84-42-94-75 57 2 99 24 94 75Z"/><path d="M179 174c55-6 84-42 94-75-57 2-99 24-94 75Z"/><path d="M180 176c-60 16-101 0-116-25 54-20 96-9 116 25Zm0 0c60 16 101 0 116-25-54-20-96-9-116 25Z"/></g><path d="M145 188h70" stroke="#d9b67b" stroke-width="5"/>';
const water = '<path d="M12 174q40-36 83 0t83 0 83 0 83 0v75H0Z" fill="#567f7c"/><path d="M0 198q40-29 83 0t83 0 83 0 83 0" fill="none" stroke="#b6cec0" stroke-width="4"/>';
const motifs = {
  blade, shield, guard: ridge, fire: flame, draw: scroll,
  stop: seal + '<path d="m90 185 21-100m136 89 25-95" stroke="#a9b7a0" stroke-width="4"/>',
  heavy: ridge + blade,
  flame: `<g transform="translate(-46 18) scale(.82)">${flame}</g><g transform="translate(66 -8) scale(.82)">${flame}</g>`,
  ember: '<path d="M103 191h163l-27 19H125Z" fill="#4b3730"/><path d="m125 192 30-49 16 27 35-54 32 76Z" fill="#b2573d"/>' + sparks,
  ash: shield + `<g transform="translate(80 82) scale(.55)">${flame}</g>`,
  hold: shield + '<path d="M180 79v78m-30-39h60" stroke="#d4ceaa" stroke-width="5"/>',
  quake: ridge + '<path d="m180 60-15 63 22 8-26 75m70-64 34 48m-137-43-31 43" fill="none" stroke="#d6bd80" stroke-width="5"/>',
  rock: ridge + ring,
  gather: ring + '<g fill="#c4cdb0"><circle cx="180" cy="125" r="22"/><circle cx="120" cy="74" r="9"/><circle cx="245" cy="81" r="7"/><circle cx="179" cy="190" r="6"/></g><path d="m125 80 37 32m75-24-39 24m-17 64v-31" stroke="#adbba1" stroke-width="3"/>',
  hide: scroll + `<g transform="translate(27 6) scale(.8)">${blade}</g>`,
  break: ridge + '<path d="m99 183 126-122m-87 130 114-98" stroke="#e2c68c" stroke-width="8"/>' + sparks,
  guide: scroll + '<path d="m78 151 65-44-6 29 92-18" fill="none" stroke="#cea36b" stroke-width="5"/>',
  exchange: '<g transform="translate(-26 -16) scale(.85)">' + scroll + '</g><g transform="translate(67 48) scale(.8)">' + scroll + '</g>' + swirl,
  steady: shield + seal,
  qi: orb + ring, spin: swirl + blade,
  wind: swirl + '<path d="m63 150 23-28m197-14 20 24" stroke="#c6d8c3" stroke-width="5"/>',
  water: water + '<path d="M180 49c-58 74-48 107 0 111 49-3 58-39 0-111Z" fill="url(#pearl)" stroke="#b7d5ca" stroke-width="3"/>',
};
const skills = {
  lotus, twin: motifs.flame, seal: ring + seal, wave: motifs.quake,
  hiddenSlash: ring + blade, lava: ridge + flame, bladeWard: shield + blade,
  breath: scroll + ring, orb, windBlade: orb + swirl,
  fireOrb: `<g opacity=".85">${flame}</g>${orb}`,
  mountainOrb: ridge + orb,
  flameWheel: flame + orb + swirl,
  boomerang: blade + swirl,
  fireSpin: flame + swirl,
  vortex: water + swirl,
  mist: water + '<g fill="none" stroke="#d0d2b8" stroke-width="16" opacity=".6"><path d="M38 122q68-29 151 0t137-6M5 149q85-23 177 0t161-3"/></g>',
};
const relics = {
  cinnabar: '<path d="M107 154 144 93h106l-14 77H104Z" fill="#313e38" stroke="#a59572" stroke-width="4"/><ellipse cx="181" cy="124" rx="37" ry="18" fill="#ae4c35"/>',
  emberLamp: '<path d="M129 177h103l-20-14-10-53h-41l-10 53Z" fill="#86714e" stroke="#c5b080" stroke-width="3"/>' + `<g transform="translate(94 24) scale(.48)">${flame}</g>`,
  paperweight: '<path d="m86 146 37-37 151 13-36 39Z" fill="#739282" stroke="#bcc5a2" stroke-width="3"/><path d="m86 146 5 21 150 13-3-19m3 19 33-37v-21" fill="#405b51" stroke="#bcc5a2" stroke-width="3"/>',
  rubbing: scroll + '<path d="m139 119 10-16h51l14 16-5 31h-64Z" fill="#4b5550"/>',
  bladeCase: '<path d="m82 163 164-80 27 26-165 81Z" fill="#514c3c" stroke="#baa474" stroke-width="4"/><path d="m115 147 21 31m55-62 19 31" stroke="#b7b69b" stroke-width="5"/>',
  bookmark: '<path d="M139 61h69v134l-34-24-35 24Z" fill="#9d563d" stroke="#d3b77e" stroke-width="4"/><circle cx="174" cy="95" r="11" fill="none" stroke="#d3b77e" stroke-width="3"/>',
};
function frame(content, name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" role="img"><title>${name}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#263e40"/><stop offset="1" stop-color="#718775"/></linearGradient><radialGradient id="pearl"><stop stop-color="#d4e0c3"/><stop offset=".55" stop-color="#86b5a9"/><stop offset="1" stop-color="#2c6269"/></radialGradient><filter id="grain"><feTurbulence baseFrequency=".65" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><g filter="url(#grain)"><rect width="360" height="240" fill="url(#sky)"/><circle cx="292" cy="46" r="22" fill="#e5ddba" opacity=".55"/><path d="M0 182 60 148 139 187 237 134 360 171v70H0Z" fill="#1c3338" opacity=".4"/>${content}${sparks}<path d="M0 223q95-24 185-7t175-2v26H0Z" fill="#172e31" opacity=".8"/></g></svg>`;
}
for (const [key, motif] of Object.entries(motifs)) fs.writeFileSync(new URL(`${key}.svg`, out), frame(motif, `字卡画意 · ${config.cards[key].name}`));
for (const [key, motif] of Object.entries(skills)) fs.writeFileSync(new URL(`skill-${key}.svg`, out), frame(motif, `组合术式 · ${config.recipes[key].name}`));
for (const [key, motif] of Object.entries(relics)) fs.writeFileSync(new URL(`relic-${key}.svg`, out), frame(motif, `遗物 · ${config.relics[key].name}`));
const monsters = {
  ink: '<path d="M61 245c11-74 13-133 65-147l42-65 33 44 42-2 24 98 54 73Z" fill="#263739" stroke="#617666" stroke-width="5"/><path d="m117 112 34 12m38-6 36-22" stroke="#d4a35e" stroke-width="8"/><path d="m155 164 34-4 19 33-36-13Z" fill="#a8553c"/><path d="m75 154-31 43m221-80 47 49" stroke="#263739" stroke-width="16"/>',
  beetle: '<ellipse cx="177" cy="163" rx="76" ry="77" fill="#465a50" stroke="#94a48a" stroke-width="5"/><path d="M177 92v145m-55-102 102 61m-104-8 96-43" stroke="#273e39" stroke-width="6"/><path d="m106 133-37-20-16 28m51 47-48 5-20 31m215-88 38-28 17 26m-53 54 48 9 17 24" fill="none" stroke="#31473e" stroke-width="13"/><path d="m144 94 12-22h37l17 22" fill="#35493f"/><circle cx="158" cy="88" r="5" fill="#d3b177"/><circle cx="195" cy="88" r="5" fill="#d3b177"/>',
  colossus: '<path d="m123 93 14-63h79l21 63-19 21h-76Z" fill="#59685b" stroke="#283d38" stroke-width="6"/><path d="M116 110h128l21 115H93Z" fill="#59685b" stroke="#283d38" stroke-width="7"/><path d="m108 114-40 20-14 83 39 2 30-59m127-46 39 20 17 83-43 2-25-59" fill="#627162" stroke="#283d38" stroke-width="6"/><path d="m163 34-13 30 30 8-7 29m-17 14 33 43-28 25 33 42" fill="none" stroke="#cfb679" stroke-width="5"/><path d="m145 76 19-2m29 0 19 2" stroke="#dab077" stroke-width="6"/>',
};
for (const [key, motif] of Object.entries(monsters)) {
  const name = {ink:'寒墨妖与镇塔墨魇',beetle:'碑蛀',colossus:'裂碑巨像'}[key];
  fs.writeFileSync(new URL(`enemy-${key}.svg`, out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 260"><title>试炼妖物 · ${name}</title>${motif}</svg>`);
}
console.log(`已生成${Object.keys(motifs).length + Object.keys(skills).length + Object.keys(relics).length + Object.keys(monsters).length}份独立矢量资产。`);
