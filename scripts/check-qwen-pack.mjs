import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRuntimeFiles } from './qwen/stage-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
ok(pkg.scripts['dist:full'] === 'node scripts/pack-full.mjs', 'dist:full script');
ok(!JSON.stringify(pkg.build.files).includes('.local'), 'slim files glob does not pull .local');

const full = JSON.parse(readFileSync(path.join(root, 'electron', 'builder.full.json'), 'utf8'));
const extras = JSON.stringify(full.extraResources);
ok(extras.includes('qwen/bin'), 'full builder copies runtime');
ok(extras.includes('qwen/models'), 'full builder copies model');
ok(extras.includes('Qwen3.5-2B-Q4_K_M.gguf'), 'full builder names the GGUF');
ok(JSON.stringify(full.files || []).includes('!.local/**'), 'full builder excludes .local from asar');
ok(full.productName === '奥术对决', 'full builder keeps product name');

const main = readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8');
ok(main.includes("require('./qwen.cjs')"), 'main loads qwen sidecar');
ok(main.includes('ensureSidecar'), 'main starts sidecar');
ok(main.includes('isQwenRequest'), 'main proxies /qwen');

const llm = readFileSync(path.join(root, 'src', 'pseudoai', 'llm.js'), 'utf8');
ok(llm.includes('/qwen/health'), 'renderer still probes /qwen');
ok(llm.includes('127.0.0.1:8721'), 'renderer still falls back to sidecar port');

const files = listRuntimeFiles();
if (files.length) {
  ok(files.includes('llama-server.exe'), 'runtime list includes llama-server');
  ok(files.includes('ggml-vulkan.dll'), 'runtime list includes vulkan backend');
  ok(files.some((name) => /^ggml-cpu-/.test(name)), 'runtime list includes cpu backends');
  ok(!files.some((name) => /llama-cli|llama-bench|llama-quantize/.test(name)), 'runtime list omits extra tools');
}

if (fails.length) {
  console.error(fails.map((m) => `fail: ${m}`).join('\n'));
  process.exit(1);
}
console.log('qwen pack checks ok');
