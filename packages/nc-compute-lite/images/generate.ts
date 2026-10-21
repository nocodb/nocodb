#!/usr/bin/env bun
/**
 * NocoDB's E2B templates as Docker build contexts, from the same sources, so
 * lite sandboxes match E2B ones. Run inside an nc-e2b-template checkout's deps:
 *
 *   bun run generate.ts --source <checkout> --code-interpreter <image> --out <dir> [alias ...]
 *
 * A template built on E2B's code-interpreter-v1 starts from <image>, that
 * template as a Docker image (e2b-dev/code-interpreter's build_docker.py).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ON_PREM = ['nc-script-template', 'nc-app-runtime', 'nc-app-builder', 'nc-chat-template'];

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  if (i === -1 || !argv[i + 1]) throw new Error(`${name} is required`);
  return argv.splice(i, 2)[1]!;
};
const source = flag('--source');
const codeInterpreter = flag('--code-interpreter');
const out = flag('--out');
const aliases = argv.length ? argv : ON_PREM;

type Instruction = { type: string; args: string[] };
type TemplateInternals = {
  baseTemplate?: string;
  baseImage?: string;
  fileContextPath: string;
  instructions: Instruction[];
};

const { loadTemplates } = await import(join(source, 'src/registry.ts'));
const specs = (await loadTemplates()) as { alias: string; prepare?: () => Promise<void>; define: () => unknown }[];

const quote = (s: string) => JSON.stringify(s);

for (const alias of aliases) {
  const spec = specs.find((s) => s.alias === alias);
  if (!spec) throw new Error(`${alias} is not a template in ${source}`);
  if (spec.prepare) await spec.prepare();
  const t = spec.define() as TemplateInternals;

  let base: string;
  // The user the base image leaves current: E2B's code-interpreter ends as `user`.
  let current: string;
  if (t.baseTemplate === 'code-interpreter-v1') {
    base = codeInterpreter;
    current = 'user';
  } else if (t.baseImage) {
    base = t.baseImage;
    current = 'root';
  } else {
    throw new Error(`${alias}: base template '${t.baseTemplate}' has no Docker image here`);
  }

  const lines = [
    `FROM ${base}`,
    'USER root',
    // What E2B adds to every image: a sudo-capable `user`.
    "RUN id -u user >/dev/null 2>&1 || useradd -m -s /bin/bash user",
    "RUN (command -v sudo >/dev/null || (apt-get update && apt-get install -y --no-install-recommends sudo && rm -rf /var/lib/apt/lists/*)) && echo 'user ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/user",
    `USER ${current}`,
  ];

  for (const { type, args } of t.instructions) {
    if (type === 'USER') {
      current = args[0]!;
      lines.push(`USER ${current}`);
    } else if (type === 'RUN') {
      const [cmd, user] = args;
      if (user && user !== current) lines.push(`USER ${user}`, `RUN ${cmd}`, `USER ${current}`);
      else lines.push(`RUN ${cmd}`);
    } else if (type === 'COPY') {
      const [src, dest, user, mode] = args;
      const chmod = mode ? ` --chmod=${mode}` : '';
      lines.push(`COPY --chown=${user || current}${chmod} ${src} ${dest}`);
    } else if (type === 'ENV') {
      const pairs: string[] = [];
      for (let i = 0; i < args.length; i += 2) pairs.push(`${args[i]}=${quote(args[i + 1] ?? '')}`);
      lines.push(`ENV ${pairs.join(' ')}`);
    } else {
      lines.push(`${type} ${args.join(' ')}`);
    }
  }

  lines.push(
    'USER root',
    'COPY --chmod=755 nc-sandbox-init /usr/local/bin/nc-sandbox-init',
    'ENTRYPOINT ["/usr/local/bin/nc-sandbox-init"]',
  );

  const dir = join(out, alias);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(t.fileContextPath, dir, { recursive: true, filter: (p) => !p.includes('/node_modules') });
  cpSync(join(import.meta.dirname, 'sandbox-init.sh'), join(dir, 'nc-sandbox-init'));
  writeFileSync(join(dir, 'Dockerfile'), lines.join('\n') + '\n');
  console.log(`${alias}: ${dir}/Dockerfile (from ${base})`);
}
