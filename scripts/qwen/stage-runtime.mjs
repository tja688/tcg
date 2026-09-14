import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { QWEN, llamaServerPath } from './config.mjs';

const NAMED = [
  'llama-server.exe',
  'llama-server-impl.dll',
  'llama.dll',
  'llama-common.dll',
  'mtmd.dll',
  'ggml.dll',
  'ggml-base.dll',
  'ggml-vulkan.dll',
  'libomp.dll',
];

export function listRuntimeFiles(binDir = QWEN.binDir) {
  if (!existsSync(binDir)) return [];
  const names = new Set(NAMED);
  for (const name of readdirSync(binDir)) {
    if (/^ggml-cpu-.*\.dll$/i.test(name)) names.add(name);
  }
  return [...names].filter((name) => existsSync(path.join(binDir, name))).sort();
}

export function stageRuntime(destBin) {
  if (!existsSync(llamaServerPath())) {
    throw new Error('llama-server missing, run npm run qwen:setup');
  }
  rmSync(destBin, { recursive: true, force: true });
  mkdirSync(destBin, { recursive: true });
  const files = listRuntimeFiles();
  for (const name of files) {
    copyFileSync(path.join(QWEN.binDir, name), path.join(destBin, name));
  }
  if (!existsSync(path.join(destBin, 'llama-server.exe'))) {
    throw new Error('failed to stage llama-server.exe');
  }
  return files;
}
