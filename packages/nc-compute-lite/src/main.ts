import { startApi } from './api.ts';
import { config } from './config.ts';
import { docker } from './docker.ts';
import { startProxy } from './proxy.ts';
import { sandboxes } from './sandboxes.ts';

for (let attempt = 0; ; attempt++) {
  try {
    await docker.ping();
    break;
  } catch (e) {
    if (attempt === 30) throw new Error(`no Docker engine at ${config.dockerSocket}: ${String(e)}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

await sandboxes.init();
startApi();
startProxy();
console.log(JSON.stringify({ level: 'info', msg: 'nc-compute-lite ready', docker: config.dockerMode }));
