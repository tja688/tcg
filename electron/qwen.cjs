'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app, net } = require('electron');

const HOST = '127.0.0.1';
const PORT = 8721;
const MODEL_NAME = 'Qwen3.5-2B-Q4_K_M.gguf';
const ALIAS = 'Qwen3.5-2B';

let child = null;
let startedByUs = false;

function runtimeRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'qwen');
  return path.join(__dirname, '..', '.local', 'qwen');
}

function paths() {
  const root = runtimeRoot();
  return {
    root,
    binDir: path.join(root, 'bin'),
    exe: path.join(root, 'bin', 'llama-server.exe'),
    model: path.join(root, 'models', MODEL_NAME),
  };
}

async function ping(timeoutMs = 800) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await net.fetch(`http://${HOST}:${PORT}/health`, { signal: ac.signal });
    const text = await res.text();
    return res.ok && (text.includes('ok') || res.status === 200);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function spawnServer() {
  const { binDir, exe, model } = paths();
  if (!fs.existsSync(exe)) {
    console.warn('[qwen] skip sidecar: llama-server.exe missing');
    return null;
  }
  if (!fs.existsSync(model)) {
    console.warn('[qwen] skip sidecar: GGUF missing');
    return null;
  }

  const logDir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const log = fs.createWriteStream(path.join(logDir, 'qwen-server.log'), { flags: 'a' });
  const proc = spawn(exe, [
    '-m', model,
    '--host', HOST,
    '--port', String(PORT),
    '-c', '2048',
    '-n', '64',
    '-ngl', '99',
    '--alias', ALIAS,
    '--jinja',
    '--chat-template-kwargs', '{"enable_thinking":false}',
  ], {
    cwd: binDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  proc.stdout.pipe(log);
  proc.stderr.pipe(log);
  proc.on('exit', (code) => {
    log.write(`\n[exit ${code}]\n`);
    if (child === proc) {
      child = null;
      startedByUs = false;
    }
  });
  return proc;
}

async function ensureSidecar() {
  if (await ping()) {
    console.log(`[qwen] sidecar already up on :${PORT}`);
    return { already: true };
  }
  child = spawnServer();
  if (!child) return { missing: true };
  startedByUs = true;
  console.log(`[qwen] sidecar spawning pid=${child.pid}`);
  return { child };
}

function stopSidecar() {
  if (!startedByUs || !child) return;
  const pid = child.pid;
  child = null;
  startedByUs = false;
  if (!pid) return;
  spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

function isQwenRequest(requestUrl) {
  try {
    const pathname = new URL(requestUrl).pathname;
    return pathname === '/qwen' || pathname.startsWith('/qwen/');
  } catch {
    return false;
  }
}

function proxyQwen(request) {
  const src = new URL(request.url);
  const destPath = src.pathname.replace(/^\/qwen/, '') || '/';
  const dest = `http://${HOST}:${PORT}${destPath}${src.search}`;
  const init = {
    method: request.method,
    headers: request.headers,
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }
  return net.fetch(dest, init).catch(() => new Response('{"error":"qwen unavailable"}', {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  }));
}

module.exports = {
  ensureSidecar,
  stopSidecar,
  isQwenRequest,
  proxyQwen,
  paths,
};
