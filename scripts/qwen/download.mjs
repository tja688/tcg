import { spawn } from 'node:child_process';
import { existsSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { QWEN, ensureDirs } from './config.mjs';

export function downloadFile(url, dest, expectedBytes = 0) {
  return new Promise((resolve, reject) => {
    const tmp = `${dest}.part`;
    const args = ['-L', '--retry', '5', '--retry-delay', '2', '--connect-timeout', '20', '-C', '-', '-o', tmp, url];
    const child = spawn('curl.exe', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`curl ${url} exit ${code}`));
        return;
      }
      if (!existsSync(tmp)) {
        reject(new Error(`missing ${tmp}`));
        return;
      }
      const size = statSync(tmp).size;
      if (expectedBytes && size < expectedBytes * 0.98) {
        reject(new Error(`incomplete ${path.basename(dest)}: ${size}/${expectedBytes}`));
        return;
      }
      if (existsSync(dest)) unlinkSync(dest);
      renameSync(tmp, dest);
      resolve(size);
    });
  });
}

export async function downloadFirst(urls, dest, expectedBytes = 0) {
  ensureDirs();
  if (existsSync(dest)) {
    const size = statSync(dest).size;
    if (!expectedBytes || size >= expectedBytes * 0.98) {
      console.log(`[qwen] already have ${path.basename(dest)} (${size} bytes)`);
      return dest;
    }
  }
  let last = null;
  for (const url of urls) {
    console.log(`[qwen] downloading ${url}`);
    try {
      await downloadFile(url, dest, expectedBytes);
      return dest;
    } catch (err) {
      last = err;
      console.warn(`[qwen] failed: ${err.message}`);
    }
  }
  throw last || new Error(`all mirrors failed for ${dest}`);
}

export const MODEL_URLS = [
  'https://hf-mirror.com/lmstudio-community/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
  'https://huggingface.co/lmstudio-community/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
  'https://www.modelscope.cn/models/diodel/Qwen3.5-2B-Q4_K_M-GGUF/resolve/master/Qwen3.5-2B-Q4_K_M.gguf',
];

export const VULKAN_URLS = [
  `https://github.com/ggml-org/llama.cpp/releases/download/${QWEN.llamaTag}/llama-${QWEN.llamaTag}-bin-win-vulkan-x64.zip`,
];
