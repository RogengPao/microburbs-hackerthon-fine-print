// Watches both builds in one command (`npm run watch`). Vite has no built-in
// multi-config watch, so this spawns one watcher per config. After each rebuild,
// reload the listing tab (the panel iframe refetches panel.html) — manifest or
// dist/ shape changes need a full reload on chrome://extensions.
import { spawn } from 'node:child_process';

const builds = [
  ['vite', ['build', '--watch']],
  ['vite', ['build', '--watch', '--config', 'vite.content.config.js']],
];

const procs = builds.map(([cmd, args]) =>
  spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' }),
);

for (const p of procs) {
  p.on('exit', (code) => {
    if (code !== 0) {
      for (const q of procs) q.kill();
      process.exitCode = code ?? 1;
    }
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    for (const p of procs) p.kill();
    process.exit();
  });
}
