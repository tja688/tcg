import { trackForScene } from '../src/audio/bgm.js';
import { BGM_FILES, bgmUrl } from '../src/audio/clips.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

ok(BGM_FILES.title.includes('cinematic'), 'title uses cinematic');
ok(BGM_FILES.explore.includes('ebunny'), 'explore uses acoustic');
ok(BGM_FILES.combat.includes('war-legend'), 'combat uses war');

const explore = ['map', 'shop', 'rest', 'event', 'treasure', 'reward', 'win', 'lose', 'mystery'];
for (const s of explore) ok(trackForScene(s) === 'explore', `${s} -> explore`);
ok(trackForScene('title') === 'title', 'title -> title');
for (const s of ['combat', 'elite', 'boss']) ok(trackForScene(s) === 'combat', `${s} -> combat`);
ok(bgmUrl('title').startsWith('/assets/audio/bgm/'), 'bgm url prefix');

if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('bgm mapping ok');
