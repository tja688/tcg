import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { QWEN, ensureDirs, llamaServerPath, modelPath } from './config.mjs';
import { MODEL_URLS, VULKAN_URLS, downloadFirst } from './download.mjs';

function unzip(zipPath, dest) {
  mkdirSync(dest, { recursive: true });
  execFileSync('powershell.exe', [
    '-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
  ], { stdio: 'inherit' });
}

function findServer(dir) {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of readdirSync(cur)) {
      const full = path.join(cur, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (name.toLowerCase() === 'llama-server.exe') return full;
    }
  }
  return null;
}

async function ensureRuntime() {
  ensureDirs();
  if (existsSync(llamaServerPath())) {
    console.log('[qwen] llama-server already installed');
    return;
  }
  const zip = path.join(QWEN.localDir, `llama-${QWEN.llamaTag}-win-vulkan.zip`);
  await downloadFirst(VULKAN_URLS, zip, 8_000_000);
  const extract = path.join(QWEN.localDir, 'extract-vulkan');
  unzip(zip, extract);
  const found = findServer(extract);
  if (!found) throw new Error('llama-server.exe not in vulkan zip');
  const srcDir = path.dirname(found);
  for (const name of readdirSync(srcDir)) {
    const from = path.join(srcDir, name);
    const to = path.join(QWEN.binDir, name);
    if (statSync(from).isFile()) {
      if (existsSync(to)) unlinkSync(to);
      renameSync(from, to);
    }
  }
  if (!existsSync(llamaServerPath())) throw new Error('failed to place llama-server.exe');
  console.log('[qwen] llama-server ready');
}

async function ensureModel() {
  ensureDirs();
  await downloadFirst(MODEL_URLS, modelPath(), QWEN.expectedModelBytes);
}

if (process.argv.includes('--runtime-only')) {
  await ensureRuntime();
} else {
  await Promise.all([ensureRuntime(), ensureModel()]);
}
console.log('[qwen] setup complete');
