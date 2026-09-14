import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpOut = path.join(os.tmpdir(), 'tcg-electron-release');
const dest = path.join(root, 'release');

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

await run('npx', ['vite', 'build']);
await rm(tmpOut, { recursive: true, force: true });
await run('npx', [
  'electron-builder',
  '--win',
  'portable',
  '--x64',
  `--config.directories.output=${tmpOut}`,
]);

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

const names = await readdir(tmpOut);
for (const name of names) {
  if (!name.endsWith('.exe')) continue;
  await cp(path.join(tmpOut, name), path.join(dest, name));
  console.log(`copied ${name} -> release/`);
}

console.log(`portable build ready: ${dest}`);
