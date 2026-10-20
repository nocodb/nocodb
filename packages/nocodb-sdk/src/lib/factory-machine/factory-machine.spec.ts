import {
  applyFactoryMachineSuggestion,
  canonicalFactoryMachineSpec,
  detectFactoryMachine,
  FACTORY_MACHINE_CATALOG,
  factoryMachineAdditions,
  factoryMachineBuildSteps,
  factoryMachineRemovals,
  factoryMachineRuntime,
  isEmptyFactoryMachineRemoval,
  isEmptyFactoryMachineSpec,
  mergeFactoryMachineSpec,
  validateFactoryMachineSpec,
} from '.';

describe('factory-machine', () => {
  describe('canonicalFactoryMachineSpec', () => {
    it('orders, de-duplicates and defaults versions', () => {
      const a = canonicalFactoryMachineSpec({
        items: [{ id: 'redis' }, { id: 'node' }, { id: 'node', version: '20' }],
        apt: ['jq', ' curl ', 'jq'],
      });
      const b = canonicalFactoryMachineSpec({
        items: [{ id: 'node', version: '24' }, { id: 'redis' }],
        apt: ['curl', 'jq'],
      });

      expect(a).toEqual(b);
      expect(a.items).toEqual([{ id: 'node', version: '24' }, { id: 'redis' }]);
    });
  });

  describe('validateFactoryMachineSpec', () => {
    it('accepts every catalog item at every version', () => {
      for (const item of FACTORY_MACHINE_CATALOG) {
        const items = [
          { id: item.id, version: item.versions?.[0] },
          ...(item.id === 'poetry' ? [{ id: 'python' }] : []),
        ];
        expect(validateFactoryMachineSpec({ items })).toEqual([]);
      }
    });

    it('rejects unknown items, versions and missing requirements', () => {
      expect(
        validateFactoryMachineSpec({
          items: [
            { id: 'cobol' },
            { id: 'node', version: '7' },
            { id: 'poetry' },
          ],
        })
      ).toEqual([
        "Unknown item 'cobol'",
        "Node.js has no version '7'",
        'Poetry needs Python',
      ]);
    });

    it('rejects package names that would be commands', () => {
      expect(
        validateFactoryMachineSpec({ items: [], apt: ['jq; rm -rf /'] })
      ).toEqual(["'jq; rm -rf /' is not a valid apt package name"]);
    });

    it('takes registry names with versions, never URL, git or file sources', () => {
      const ok = {
        items: [{ id: 'python' }],
        apt: ['g++', 'nginx=1.18.0-0ubuntu1'],
        npm: ['@types/node', 'lodash@4.17.21'],
        pip: ['requests==2.31.0', 'numpy>=1.20'],
      };
      expect(validateFactoryMachineSpec(ok)).toEqual([]);

      for (const name of [
        'git+https://github.com/u/r.git',
        'https://evil.example/x.tgz',
        'github:u/r',
        'file:../x',
        'user/repo',
        'pkg@npm:x',
        '-rf',
      ]) {
        expect(
          validateFactoryMachineSpec({ items: [], npm: [name] })
        ).toEqual([`'${name}' is not a valid npm package name`]);
      }
    });

    it('needs Python for pip packages', () => {
      expect(validateFactoryMachineSpec({ items: [], pip: ['ruff'] })).toEqual([
        'pip packages need Python',
      ]);
    });
  });

  describe('factoryMachineBuildSteps', () => {
    const all = {
      items: FACTORY_MACHINE_CATALOG.map((item) => ({
        id: item.id,
        version: item.versions?.[0],
      })),
      apt: ['libvips-dev'],
      npm: ['turbo'],
      pip: ['ruff'],
      commands: ['echo done'],
    };

    it('never emits a backslash, which the builder strips', () => {
      for (const step of factoryMachineBuildSteps(all)) {
        for (const command of step.commands) {
          expect(command).not.toContain('\\');
        }
      }
    });

    it('runs steps in a fixed order', () => {
      expect(factoryMachineBuildSteps(all).map((step) => step.id)).toEqual([
        'system',
        'languages',
        'services',
        'tools',
        'packages',
        'custom',
      ]);
    });

    it('installs mise tools in one call', () => {
      const steps = factoryMachineBuildSteps({
        items: [
          { id: 'node', version: '22' },
          { id: 'go', version: '1.26' },
        ],
      });
      const languages = steps.find((step) => step.id === 'languages');

      expect(
        languages.commands.filter((c) => c.includes('mise use -g'))
      ).toEqual([expect.stringContaining('mise use -g node@22 go@1.26')]);
    });
  });

  describe('factoryMachineRuntime', () => {
    it('puts mise shims first and starts services', () => {
      const runtime = factoryMachineRuntime({
        items: [{ id: 'node' }, { id: 'postgres' }, { id: 'redis' }],
      });

      expect(runtime.envs.PATH.split(':')[0]).toBe('/opt/mise/shims');
      expect(runtime.envs.DATABASE_URL).toContain('postgres');
      expect(runtime.envs.REDIS_URL).toBe('redis://localhost:6379');
      expect(runtime.startCommands).toEqual([
        'service postgresql start',
        'service redis-server start',
      ]);
    });
  });

  describe('detectFactoryMachine', () => {
    it('reads versions and services from repo files', () => {
      const { spec, reasons } = detectFactoryMachine({
        '.nvmrc': 'v22.11.0\n',
        'package.json': JSON.stringify({
          packageManager: 'pnpm@10.4.1',
          devDependencies: { '@playwright/test': '1.50.0' },
        }),
        'go.mod': 'module x\n\ngo 1.26.2\n',
        'docker-compose.yml':
          'services:\n  db:\n    image: postgres:16-alpine\n  cache:\n    image: redis:7\n',
      });

      expect(spec.items).toEqual([
        { id: 'node', version: '22' },
        { id: 'go', version: '1.26' },
        { id: 'pnpm', version: '10' },
        { id: 'postgres', version: '16' },
        { id: 'redis' },
        { id: 'docker' },
        { id: 'playwright' },
      ]);
      expect(reasons).toContainEqual({ id: 'node', file: '.nvmrc' });
      expect(reasons).toContainEqual({
        id: 'postgres',
        file: 'docker-compose.yml',
      });
    });

    it('falls back to the default version when it cannot match', () => {
      const { spec } = detectFactoryMachine({
        '.python-version': '3.8.18',
        'requirements.txt': '',
      });

      expect(spec.items).toEqual([{ id: 'python', version: '3.14' }]);
    });
  });

  describe('mergeFactoryMachineSpec / factoryMachineAdditions', () => {
    const base = {
      items: [
        { id: 'node', version: '22' },
        { id: 'postgres', version: '16' },
      ],
      apt: ['jq'],
    };

    it('adds new items and lets the addition move a version', () => {
      const merged = mergeFactoryMachineSpec(base, {
        items: [{ id: 'redis' }, { id: 'node', version: '24' }],
        apt: ['jq', 'ffmpeg'],
      });

      expect(merged.items).toEqual([
        { id: 'node', version: '24' },
        { id: 'postgres', version: '16' },
        { id: 'redis' },
      ]);
      expect(merged.apt).toEqual(['ffmpeg', 'jq']);
    });

    it('keeps only what the base lacks', () => {
      expect(
        factoryMachineAdditions(base, {
          items: [{ id: 'node', version: '22' }, { id: 'playwright' }],
          apt: ['jq', 'libvips-dev'],
        })
      ).toEqual({
        items: [{ id: 'playwright' }],
        apt: ['libvips-dev'],
        npm: [],
        pip: [],
        commands: [],
      });
    });

    it('keeps setup commands the base does not run yet', () => {
      expect(
        factoryMachineAdditions(
          { ...base, commands: ['corepack enable'] },
          {
            items: [],
            commands: ['corepack enable', 'npx playwright install chromium'],
          }
        ).commands
      ).toEqual(['npx playwright install chromium']);
    });

    it('removes only what the base has, and applies a whole suggestion', () => {
      const withCmd = { ...base, commands: ['corepack enable'] };

      expect(
        factoryMachineRemovals(withCmd, {
          items: ['postgres', 'redis'],
          apt: ['jq'],
          commands: ['corepack enable', 'nope'],
        })
      ).toEqual({
        items: ['postgres'],
        apt: ['jq'],
        npm: [],
        pip: [],
        commands: ['corepack enable'],
      });
      expect(isEmptyFactoryMachineRemoval({ items: [] })).toBe(true);

      expect(
        applyFactoryMachineSuggestion(withCmd, {
          add: { items: [{ id: 'node', version: '24' }], apt: ['ffmpeg'] },
          remove: {
            items: ['postgres'],
            apt: ['jq'],
            commands: ['corepack enable'],
          },
        })
      ).toEqual({
        items: [{ id: 'node', version: '24' }],
        apt: ['ffmpeg'],
        npm: [],
        pip: [],
        commands: [],
      });
    });

    it('finds nothing to add when the base has it all', () => {
      expect(
        isEmptyFactoryMachineSpec(
          factoryMachineAdditions(base, { items: [{ id: 'postgres' }] })
        )
      ).toBe(false);
      expect(
        isEmptyFactoryMachineSpec(
          factoryMachineAdditions(base, {
            items: [{ id: 'postgres', version: '16' }],
          })
        )
      ).toBe(true);
    });
  });
});
