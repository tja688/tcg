import { PACK_IDS, assertPacks } from '../src/run/packs.js';
import { simulateRun, summarize } from '../src/sim/run.js';

assertPacks();

const perPack = Math.max(1, parseInt(process.argv[2] || '80', 10));
const results = [];
const t0 = Date.now();

for (const packId of PACK_IDS) {
  for (let i = 0; i < perPack; i++) {
    const seed = 410000 + i * 97 + packId.charCodeAt(0) * 1000;
    results.push(await simulateRun(seed, packId));
  }
}

const summary = summarize(results);
summary.elapsedMs = Date.now() - t0;
console.log(JSON.stringify(summary, null, 2));
