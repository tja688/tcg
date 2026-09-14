import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpOut = path.join(os.tmpdir(), 'tcg-electron-release');
const destDir = path.join(root, 'release');
const destExe = path.join(destDir, '奥术对决.exe');

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

async function stopOldPortable() {
  await Promise.all([
    taskkill('奥术对决.exe'),
    taskkill('ArcaneDuel-0.1.0-Portable.exe'),
    taskkill('ArcaneDuel-Portable.exe'),
  ]);
}

await stopOldPortable();
await rm(destDir, { recursive: true, force: true });
await rm(tmpOut, { recursive: true, force: true });

await run('npx', ['vite', 'build']);
await run('npx', [
  'electron-builder',
  '--win',
  'portable',
  '--x64',
  `--config.directories.output=${tmpOut}`,
]);

await mkdir(destDir, { recursive: true });
const built = (await readdir(tmpOut)).find((name) => name.endsWith('.exe'));
if (!built) throw new Error(`no portable exe in ${tmpOut}`);
await cp(path.join(tmpOut, built), destExe);
await rm(tmpOut, { recursive: true, force: true });

console.log(`portable ready: ${destExe}`);
