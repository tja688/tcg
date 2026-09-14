import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const QWEN = {
  root,
  localDir: path.join(root, '.local', 'qwen'),
  binDir: path.join(root, '.local', 'qwen', 'bin'),
  modelDir: path.join(root, '.local', 'qwen', 'models'),
  logDir: path.join(root, '.local', 'qwen', 'logs'),
  modelName: 'Qwen3.5-2B-Q4_K_M.gguf',
  host: '127.0.0.1',
  port: 8721,
  llamaTag: 'b10809',
  expectedModelBytes: 1270808032,
};

export const modelPath = () => path.join(QWEN.modelDir, QWEN.modelName);
export const serverUrl = () => `http://${QWEN.host}:${QWEN.port}`;
export const llamaServerPath = () => path.join(QWEN.binDir, 'llama-server.exe');

export function ensureDirs() {
  for (const d of [QWEN.localDir, QWEN.binDir, QWEN.modelDir, QWEN.logDir]) mkdirSync(d, { recursive: true });
}
