import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QWEN, modelPath } from './qwen/config.mjs';
import { stageRuntime } from './qwen/stage-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'release', 'full');
const tmpOut = path.join(os.tmpdir(), 'tcg-electron-full');
const stageBin = path.join(QWEN.localDir, 'stage', 'bin');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
  });
}

function taskkill(image) {
  return new Promise((resolve) => {
    const child = spawn('taskkill', ['/F', '/IM', image], {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

function bytesOf(filePath) {
  return existsSync(filePath) ? statSync(filePath).size : 0;
}

function dirBytes(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of readdirSyncSafe(cur)) {
      const full = path.join(cur, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else total += st.size;
    }
  }
  return total;
}

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function mb(n) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

await Promise.all([
  taskkill('奥术对决.exe'),
  taskkill('ArcaneDuel-0.1.0-with-qwen-Setup.exe'),
  taskkill('electron.exe'),
  taskkill('app-builder.exe'),
]);

if (!existsSync(modelPath()) || !existsSync(path.join(QWEN.binDir, 'llama-server.exe'))) {
  console.log('[pack-full] qwen runtime/model missing, running setup…');
  await run('node', ['scripts/qwen/setup.mjs']);
}

const staged = stageRuntime(stageBin);
const modelBytes = bytesOf(modelPath());
const runtimeBytes = dirBytes(stageBin);
if (modelBytes < QWEN.expectedModelBytes * 0.98) {
  throw new Error(`model too small: ${modelBytes}/${QWEN.expectedModelBytes}`);
}

await rm(outDir, { recursive: true, force: true });
await rm(tmpOut, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

console.log(`[pack-full] staged ${staged.length} runtime files (${mb(runtimeBytes)})`);
console.log(`[pack-full] model ${QWEN.modelName} (${mb(modelBytes)})`);

await run('npx', ['vite', 'build']);

const builderArgs = [
  'electron-builder',
  '--win',
  'zip',
  '--x64',
  `--config=${path.join('electron', 'builder.full.json')}`,
  `--config.directories.output=${tmpOut}`,
  '--publish',
  'never',
];
try {
  await run('npx', builderArgs);
} catch (err) {
  console.warn(`[pack-full] electron-builder failed once (${err.message}), retrying in 3s`);
  await new Promise((r) => setTimeout(r, 3000));
  await rm(tmpOut, { recursive: true, force: true });
  await run('npx', builderArgs);
}

const unpacked = path.join(tmpOut, 'win-unpacked');
const bundledModel = path.join(unpacked, 'resources', 'qwen', 'models', QWEN.modelName);
const bundledExe = path.join(unpacked, 'resources', 'qwen', 'bin', 'llama-server.exe');
if (!existsSync(bundledModel) || !existsSync(bundledExe)) {
  throw new Error('full package missing bundled qwen runtime or model');
}

const unpackedBytes = dirBytes(unpacked);
const setupName = (await readdir(tmpOut)).find((name) => name.endsWith('.zip'));
if (!setupName) throw new Error(`no zip artifact in ${tmpOut}`);
const setupPath = path.join(outDir, setupName);
await cp(path.join(tmpOut, setupName), setupPath);
try {
  await cp(unpacked, path.join(outDir, 'win-unpacked'), { recursive: true });
} catch (err) {
  console.warn(`[pack-full] could not copy unpacked tree into repo: ${err.message}`);
  console.warn(`[pack-full] unpacked app remains at ${unpacked}`);
}
const setupBytes = bytesOf(setupPath);

const report = [
  '奥术对决 · 完整包（含本地 Qwen3.5-2B）',
  '',
  `运行时文件数: ${staged.length}`,
  `llama-server / Vulkan 运行时: ${mb(runtimeBytes)}`,
  `Qwen3.5-2B-Q4_K_M.gguf: ${mb(modelBytes)}`,
  `解压后应用目录: ${mb(unpackedBytes)}  (${existsSync(path.join(outDir, 'win-unpacked')) ? path.join(outDir, 'win-unpacked') : unpacked})`,
  `分发 zip: ${mb(setupBytes)}  (${setupPath})`,
  '',
  '说明: 现有百 MB 便携包不含权重。完整包把 llama-server 与 GGUF 放进 extraResources，',
  '解压后双击「奥术对决.exe」即可。主进程会拉起 127.0.0.1:8721，无需本机先跑 qwen:setup。',
  '未使用 NSIS：把 1GB+ GGUF 嵌进安装包会触发 makensis mmap 失败。',
].join('\n');

writeFileSync(path.join(outDir, 'SIZE.txt'), `\uFEFF${report}\n`, 'utf8');
console.log(`\n${report}\n`);

await smokeBundledRuntime(bundledExe, bundledModel);
if (existsSync(path.join(outDir, 'win-unpacked'))) {
  await new Promise((r) => setTimeout(r, 800));
  await rm(tmpOut, { recursive: true, force: true }).catch((err) => {
    console.warn(`[pack-full] temp cleanup skipped: ${err.message}`);
  });
}

async function pingUrl(url, timeoutMs = 800) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function smokeBundledRuntime(exe, model) {
  const port = 8739;
  const health = `http://127.0.0.1:${port}/health`;
  if (await pingUrl(health)) {
    console.warn('[pack-full] skip bundled smoke, :8739 already in use');
    return;
  }
  console.log('[pack-full] smoking bundled llama-server on :8739…');
  const child = spawn(exe, [
    '-m', model,
    '--host', '127.0.0.1',
    '--port', String(port),
    '-c', '512',
    '-n', '8',
    '-ngl', '99',
    '--alias', 'Qwen3.5-2B',
    '--jinja',
    '--chat-template-kwargs', '{"enable_thinking":false}',
  ], {
    cwd: path.dirname(exe),
    stdio: 'ignore',
    windowsHide: true,
  });
  const started = Date.now();
  let ok = false;
  try {
    while (Date.now() - started < 90000) {
      if (child.exitCode != null) break;
      if (await pingUrl(health, 600)) {
        ok = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ok) throw new Error('bundled llama-server failed health check');
    console.log('[pack-full] bundled sidecar smoke ok');
  } finally {
    if (child.pid) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    }
  }
}
