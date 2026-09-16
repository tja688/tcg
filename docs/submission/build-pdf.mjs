// 把本目录下的参赛文档 HTML 渲染为 PDF。
// 用法：node docs/submission/build-pdf.mjs [文件名...]
// 依赖本机 Edge 或 Chrome（headless 打印），无需额外 npm 包。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'pdf');
mkdirSync(outDir, { recursive: true });

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error('未找到 Edge/Chrome，无法渲染 PDF');
  process.exit(1);
}

const picked = process.argv.slice(2);
const files = (picked.length ? picked : readdirSync(here).filter((f) => /^\d\d-.*\.html$/i.test(f)))
  .map((f) => path.resolve(here, f));

for (const html of files) {
  const pdf = path.join(outDir, path.basename(html, '.html') + '.pdf');
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=6000',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdf}`,
    pathToFileURL(html).href,
  ];
  process.stdout.write(`渲染 ${path.basename(html)} ... `);
  execFileSync(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const kb = Math.round(statSync(pdf).size / 1024);
  console.log(`完成 → ${path.relative(process.cwd(), pdf)} (${kb} KB)`);
}
