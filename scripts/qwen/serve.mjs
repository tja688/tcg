import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import { QWEN, ensureDirs, llamaServerPath, modelPath, serverUrl } from './config.mjs';

const HEALTH = `${serverUrl()}/health`;
const READY_RE = /status["']?\s*:\s*["']ok["']/i;

export async function pingQwen(timeoutMs = 800) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(HEALTH, { signal: ac.signal });
    const text = await res.text();
    return res.ok && (READY_RE.test(text) || text.includes('ok') || res.status === 200);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function waitReady(ms = 45000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await pingQwen(600)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function spawnServer() {
  if (!existsSync(llamaServerPath())) throw new Error('llama-server missing, run npm run qwen:setup');
  if (!existsSync(modelPath())) throw new Error('Qwen3.5-2B GGUF missing, run npm run qwen:setup');
  ensureDirs();
  const log = createWriteStream(path.join(QWEN.logDir, 'server.log'), { flags: 'a' });
  const args = [
    '-m', modelPath(),
    '--host', QWEN.host,
    '--port', String(QWEN.port),
    '-c', '2048',
    '-n', '64',
    '-ngl', '99',
    '--alias', 'Qwen3.5-2B',
    '--jinja',
    '--chat-template-kwargs', '{"enable_thinking":false}',
  ];
  const child = spawn(llamaServerPath(), args, {
    cwd: QWEN.binDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.stdout.on('data', (buf) => process.stdout.write(buf));
  child.stderr.on('data', (buf) => process.stderr.write(buf));
  child.on('exit', (code) => {
    log.write(`\n[exit ${code}]\n`);
  });
  return child;
}

async function warmup() {
  try {
    await fetch(`${serverUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen3.5-2B',
        messages: [{ role: 'user', content: '嗯' }],
        max_tokens: 4,
        temperature: 0.2,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
  } catch {
    /* first token can fail if template is still settling */
  }
}

export async function ensureServer() {
  if (await pingQwen()) return { already: true };
  const child = spawnServer();
  const ok = await waitReady(90000);
  if (!ok) {
    child.kill();
    throw new Error('Qwen3.5-2B server failed to become ready');
  }
  await warmup();
  return { child };
}

if (process.argv[1] && process.argv[1].includes('serve.mjs')) {
  const { already, child } = await ensureServer();
  console.log(`[qwen] ready at ${serverUrl()}${already ? ' (existing)' : ''}`);
  if (child) {
    child.on('exit', (code) => process.exit(code ?? 0));
  }
}
