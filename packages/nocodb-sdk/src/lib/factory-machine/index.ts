/**
 * App Factory machines: the packages a code project's sandbox image is
 * built with. One catalog, read by the backend to build and boot the image and
 * by the frontend to draw the picker, so the two can never disagree on what an
 * item installs.
 *
 * Every install line runs as root on the Factory desktop image (Ubuntu 22.04).
 * The E2B builder strips backslashes from RUN commands, so none may contain one.
 */

/** Bumped when an install recipe changes, so identical selections rebuild. */
export const FACTORY_MACHINE_CATALOG_VERSION = 1;

/** Picks no machine for a session: the stock image, with nothing added. */
export const FACTORY_STOCK_MACHINE = 'stock';

/** Ready-made selections a machine can start from; their names are the UI's. */
export const FACTORY_MACHINE_TEMPLATES: {
  id: string;
  spec: FactoryMachineSpec;
}[] = [
  {
    id: 'node',
    spec: {
      items: [
        { id: 'node' },
        { id: 'pnpm' },
        { id: 'postgres' },
        { id: 'playwright' },
      ],
    },
  },
  {
    id: 'python',
    spec: { items: [{ id: 'python' }, { id: 'uv' }, { id: 'postgres' }] },
  },
  {
    id: 'go',
    spec: {
      items: [
        { id: 'go' },
        { id: 'postgres' },
        { id: 'redis' },
        { id: 'docker' },
      ],
    },
  },
];

export enum FactoryMachineCategory {
  Language = 'language',
  PackageManager = 'package-manager',
  Service = 'service',
  Tool = 'tool',
}

export const FACTORY_MACHINE_CATEGORIES: {
  id: FactoryMachineCategory;
  title: string;
}[] = [
  { id: FactoryMachineCategory.Language, title: 'Languages' },
  { id: FactoryMachineCategory.PackageManager, title: 'Package managers' },
  { id: FactoryMachineCategory.Service, title: 'Services' },
  { id: FactoryMachineCategory.Tool, title: 'Tools' },
];

export interface FactoryMachineSelection {
  id: string;
  /** One of the item's `versions`; omitted for an unversioned item. */
  version?: string;
}

export interface FactoryMachineSpec {
  items: FactoryMachineSelection[];
  apt?: string[];
  npm?: string[];
  pip?: string[];
  /** Run as root, in order, after everything else. */
  commands?: string[];
}

export type FactoryMachineStepId =
  | 'system'
  | 'languages'
  | 'services'
  | 'tools'
  | 'packages'
  | 'custom';

export interface FactoryMachineBuildStep {
  id: FactoryMachineStepId;
  title: string;
  /** What the step installs, for the progress list. */
  detail: string;
  commands: string[];
}

export type FactoryMachineVersionStatus =
  | 'building'
  | 'ready'
  | 'failed'
  | 'cancelled';

/**
 * A named machine on a code project: what a session's sandbox starts from.
 * A project can have several; one is its default.
 */
export interface FactoryMachineType {
  id: string;
  base_id: string;
  title: string;
  is_default: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** A machine with its version in use and its newest build, for listing. */
export interface FactoryMachineSummary extends FactoryMachineType {
  active?: FactoryMachineVersionType;
  latest?: FactoryMachineVersionType;
  version_count: number;
  /** The version in use was built on an older base image or catalog; rebuilding its spec upgrades it. */
  outdated?: boolean;
}

export interface FactoryMachinesState {
  /** False when the deployment cannot build images (no E2B key). */
  available: boolean;
  machines: FactoryMachineSummary[];
}

/** One build (version) of a machine. */
export interface FactoryMachineVersionType {
  id: string;
  base_id: string;
  fk_machine_id: string;
  version: number;
  spec: FactoryMachineSpec;
  status: FactoryMachineVersionStatus;
  /** The version the machine's sessions start from. At most one per machine. */
  is_active: boolean;
  /** The step the build is on, or failed in. */
  step?: FactoryMachineStepId | 'base' | 'save';
  log?: string;
  error?: string;
  /** Served from an identical image built earlier, so nothing was built. */
  reused?: boolean;
  /** A failed build's proposed correction, read from its log. */
  suggestion?: FactoryMachineFix;
  created_by?: string;
  built_at?: string;
  created_at?: string;
}

/** A corrected selection for a failed build, and why. */
export interface FactoryMachineFix {
  summary: string;
  spec: FactoryMachineSpec;
}

/**
 * What `suggest_machine_change` hands the chat: packages the agent had to
 * install itself, offered for the session's machine so later sessions start
 * with them.
 */
/** What a suggestion takes off a machine: catalog items by id, packages and commands by text. */
export interface FactoryMachineRemoval {
  items?: string[];
  apt?: string[];
  npm?: string[];
  pip?: string[];
  commands?: string[];
}

export interface FactoryMachineSuggestion {
  type: 'machine_suggestion';
  reason: string;
  add: FactoryMachineSpec;
  remove?: FactoryMachineRemoval;
  /** The machine the session runs on; absent on the stock machine, which means a new one. */
  machine_id?: string;
  machine_title?: string;
}

/** One machine and every version of it. */
export interface FactoryMachineState {
  /** False when the deployment cannot build images (no E2B key). */
  available: boolean;
  machine: FactoryMachineType;
  active?: FactoryMachineVersionType;
  /** Newest build, whatever its status. */
  latest?: FactoryMachineVersionType;
  versions: FactoryMachineVersionType[];
  /** See {@link FactoryMachineSummary.outdated}. */
  outdated?: boolean;
}

export interface FactoryMachineDetection {
  spec: FactoryMachineSpec;
  /** Which file suggested each item. */
  reasons: { id: string; file: string }[];
}

export interface FactoryMachineRuntime {
  envs: Record<string, string>;
  /** Root commands that bring the services up when a sandbox starts. */
  startCommands: string[];
}

interface CatalogEntry {
  id: string;
  title: string;
  category: FactoryMachineCategory;
  description: string;
  /** Two-character mark for the picker tile. */
  abbr: string;
  color: string;
  textColor: string;
  /** Newest first; the first is the default. */
  versions?: string[];
  /** Installed by `mise use -g <mise>@<version>`. */
  mise?: (version?: string) => string;
  /** apt packages the install needs. */
  apt?: string[];
  /** Root commands for anything mise does not install. */
  install?: (version?: string) => string[];
  start?: (version?: string) => string;
  env?: (version?: string) => Record<string, string>;
  path?: string[];
}

export type FactoryMachineCatalogItem = Omit<
  CatalogEntry,
  'mise' | 'install' | 'start' | 'env' | 'apt' | 'path'
> & { isService: boolean };

const MISE_ENV =
  'export MISE_DATA_DIR=/opt/mise MISE_CONFIG_DIR=/etc/mise MISE_GLOBAL_CONFIG_FILE=/etc/mise/config.toml MISE_YES=1 PATH=/opt/mise/shims:$PATH';

const CODENAME = '$(. /etc/os-release && echo $VERSION_CODENAME)';

/** Adds a signed apt source. The key is fetched as-is or dearmored. */
const aptSource = (
  name: string,
  keyUrl: string,
  line: (keyring: string) => string,
  dearmor = true
) => {
  const keyring = `/usr/share/keyrings/${name}.gpg`;
  return [
    dearmor
      ? `curl -fsSL ${keyUrl} | gpg --dearmor --yes -o ${keyring}`
      : `curl -fsSL ${keyUrl} -o ${keyring}`,
    `echo "${line(keyring)}" > /etc/apt/sources.list.d/${name}.list`,
    'apt-get update',
  ];
};

const CATALOG: CatalogEntry[] = [
  // Languages
  {
    id: 'node',
    title: 'Node.js',
    category: FactoryMachineCategory.Language,
    description: 'With npm and corepack',
    abbr: 'JS',
    color: '#3c873a',
    textColor: '#ffffff',
    versions: ['24', '26', '22'],
    mise: (v) => `node@${v}`,
  },
  {
    id: 'python',
    title: 'Python',
    category: FactoryMachineCategory.Language,
    description: 'CPython with pip and venv',
    abbr: 'Py',
    color: '#3572a5',
    textColor: '#ffffff',
    versions: ['3.14', '3.13', '3.12', '3.11'],
    mise: (v) => `python@${v}`,
  },
  {
    id: 'go',
    title: 'Go',
    category: FactoryMachineCategory.Language,
    description: 'Toolchain and module cache',
    abbr: 'Go',
    color: '#007d9c',
    textColor: '#ffffff',
    versions: ['1.27', '1.26'],
    mise: (v) => `go@${v}`,
  },
  {
    id: 'rust',
    title: 'Rust',
    category: FactoryMachineCategory.Language,
    description: 'rustup, cargo, clippy and rustfmt',
    abbr: 'Rs',
    color: '#a3390c',
    textColor: '#ffffff',
    versions: ['stable', '1.96', '1.95'],
    // rustup, not mise: mise would put the toolchain in root's home.
    install: (v) => [
      `curl -fsSL https://sh.rustup.rs | RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo sh -s -- -y --no-modify-path --profile minimal --component clippy,rustfmt --default-toolchain ${v}`,
      'chmod -R a+rwX /opt/rustup /opt/cargo',
    ],
    env: () => ({ RUSTUP_HOME: '/opt/rustup', CARGO_HOME: '/opt/cargo' }),
    path: ['/opt/cargo/bin'],
  },
  {
    id: 'java',
    title: 'Java',
    category: FactoryMachineCategory.Language,
    description: 'Eclipse Temurin JDK',
    abbr: 'Jv',
    color: '#8a5a12',
    textColor: '#ffffff',
    versions: ['25', '21', '17'],
    mise: (v) => `java@temurin-${v}`,
  },
  {
    id: 'ruby',
    title: 'Ruby',
    category: FactoryMachineCategory.Language,
    description: 'With Bundler',
    abbr: 'Rb',
    color: '#b8312a',
    textColor: '#ffffff',
    versions: ['4.0', '3.4', '3.3'],
    apt: [
      'build-essential',
      'libssl-dev',
      'libyaml-dev',
      'zlib1g-dev',
      'libffi-dev',
      'libreadline-dev',
    ],
    mise: (v) => `ruby@${v}`,
  },
  {
    id: 'php',
    title: 'PHP',
    category: FactoryMachineCategory.Language,
    description: 'With Composer',
    abbr: 'Ph',
    color: '#5b5fa0',
    textColor: '#ffffff',
    versions: ['8.5', '8.4', '8.3'],
    apt: ['software-properties-common', 'unzip'],
    install: (v) => [
      'add-apt-repository -y ppa:ondrej/php',
      'apt-get update',
      `apt-get install -y --no-install-recommends php${v}-cli php${v}-mbstring php${v}-xml php${v}-curl php${v}-zip php${v}-pgsql php${v}-mysql php${v}-sqlite3`,
      'curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer',
    ],
  },
  {
    id: 'dotnet',
    title: '.NET',
    category: FactoryMachineCategory.Language,
    description: 'SDK and runtime',
    abbr: '.N',
    color: '#512bd4',
    textColor: '#ffffff',
    versions: ['10.0', '9.0', '8.0'],
    apt: ['libicu70'],
    install: (v) => [
      'curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh',
      `bash /tmp/dotnet-install.sh --channel ${v} --install-dir /usr/share/dotnet`,
      'ln -sf /usr/share/dotnet/dotnet /usr/local/bin/dotnet',
      'rm /tmp/dotnet-install.sh',
    ],
    env: () => ({
      DOTNET_ROOT: '/usr/share/dotnet',
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    }),
  },
  {
    id: 'bun',
    title: 'Bun',
    category: FactoryMachineCategory.Language,
    description: 'Runtime, bundler and test runner',
    abbr: 'Bn',
    color: '#14151a',
    textColor: '#fbf0df',
    versions: ['1.4', '1.3'],
    mise: (v) => `bun@${v}`,
  },
  {
    id: 'deno',
    title: 'Deno',
    category: FactoryMachineCategory.Language,
    description: 'TypeScript runtime',
    abbr: 'Dn',
    color: '#101015',
    textColor: '#ffffff',
    versions: ['2'],
    mise: (v) => `deno@${v}`,
  },

  // Package managers
  {
    id: 'pnpm',
    title: 'pnpm',
    category: FactoryMachineCategory.PackageManager,
    description: 'Fast, disk-efficient npm',
    abbr: 'pn',
    color: '#f69220',
    textColor: '#101015',
    versions: ['11', '10'],
    install: (v) => [`npm install -g pnpm@${v}`],
  },
  {
    id: 'yarn',
    title: 'Yarn',
    category: FactoryMachineCategory.PackageManager,
    description: 'Berry or classic',
    abbr: 'Yn',
    color: '#1f6f99',
    textColor: '#ffffff',
    versions: ['4', '1'],
    install: (v) => [
      v === '1'
        ? 'npm install -g yarn@1'
        : `npm install -g @yarnpkg/cli-dist@${v}`,
    ],
  },
  {
    id: 'uv',
    title: 'uv',
    category: FactoryMachineCategory.PackageManager,
    description: 'Python packages and projects',
    abbr: 'uv',
    color: '#de5fe9',
    textColor: '#101015',
    install: () => [
      'curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh',
    ],
  },
  {
    id: 'poetry',
    title: 'Poetry',
    category: FactoryMachineCategory.PackageManager,
    description: 'Python dependency management',
    abbr: 'Po',
    color: '#60a5fa',
    textColor: '#101015',
    install: () => ['pip install --no-cache-dir poetry'],
  },

  // Services
  {
    id: 'postgres',
    title: 'PostgreSQL',
    category: FactoryMachineCategory.Service,
    description: 'Started with each session',
    abbr: 'Pg',
    color: '#336791',
    textColor: '#ffffff',
    versions: ['18', '17', '16', '15'],
    install: (v) => [
      ...aptSource(
        'pgdg',
        'https://www.postgresql.org/media/keys/ACCC4CF8.asc',
        (keyring) =>
          `deb [signed-by=${keyring}] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main`
      ),
      `apt-get install -y --no-install-recommends postgresql-${v}`,
      // No snakeoil certificate on this image, so SSL would stop it starting.
      `sed -i 's/^ssl = on/ssl = off/' /etc/postgresql/${v}/main/postgresql.conf`,
      `{ echo 'local all all trust'; echo 'host all all 127.0.0.1/32 trust'; echo 'host all all ::1/128 trust'; } > /etc/postgresql/${v}/main/pg_hba.conf`,
    ],
    start: () => 'service postgresql start',
    env: () => ({
      DATABASE_URL: 'postgresql://postgres@localhost:5432/postgres',
      PGHOST: 'localhost',
      PGUSER: 'postgres',
    }),
  },
  {
    id: 'mysql',
    title: 'MySQL',
    category: FactoryMachineCategory.Service,
    description: 'Started with each session',
    abbr: 'My',
    color: '#00758f',
    textColor: '#ffffff',
    versions: ['8.0'],
    install: () => [
      'DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends mysql-server',
      `service mysql start && mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ''; FLUSH PRIVILEGES;" && service mysql stop`,
    ],
    start: () => 'service mysql start',
    env: () => ({ MYSQL_URL: 'mysql://root@localhost:3306' }),
  },
  {
    id: 'redis',
    title: 'Redis',
    category: FactoryMachineCategory.Service,
    description: 'Started with each session',
    abbr: 'Rd',
    color: '#c4302b',
    textColor: '#ffffff',
    install: () => [
      ...aptSource(
        'redis',
        'https://packages.redis.io/gpg',
        (keyring) =>
          `deb [signed-by=${keyring}] https://packages.redis.io/deb ${CODENAME} main`
      ),
      'apt-get install -y --no-install-recommends redis',
    ],
    start: () => 'service redis-server start',
    env: () => ({ REDIS_URL: 'redis://localhost:6379' }),
  },
  {
    id: 'mongo',
    title: 'MongoDB',
    category: FactoryMachineCategory.Service,
    description: 'Started with each session',
    abbr: 'Mg',
    color: '#13aa52',
    textColor: '#101015',
    versions: ['8.0', '7.0'],
    install: (v) => [
      ...aptSource(
        `mongodb-${v}`,
        `https://www.mongodb.org/static/pgp/server-${v}.asc`,
        (keyring) =>
          `deb [arch=amd64 signed-by=${keyring}] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/${v} multiverse`
      ),
      'apt-get install -y --no-install-recommends mongodb-org',
      'mkdir -p /var/lib/mongodb /var/log/mongodb',
    ],
    start: () =>
      'mongod --fork --bind_ip 127.0.0.1 --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log',
    env: () => ({ MONGODB_URL: 'mongodb://localhost:27017' }),
  },

  // Tools
  {
    id: 'docker',
    title: 'Docker',
    category: FactoryMachineCategory.Tool,
    description: 'Engine and Compose inside the sandbox',
    abbr: 'Dk',
    color: '#2496ed',
    textColor: '#101015',
    install: () => [
      'curl -fsSL https://get.docker.com | sh',
      'usermod -aG docker user',
    ],
    start: () => 'service docker start',
  },
  {
    id: 'playwright',
    title: 'Playwright browsers',
    category: FactoryMachineCategory.Tool,
    description: 'Chromium, Firefox and WebKit',
    abbr: 'Pw',
    color: '#2ead33',
    textColor: '#101015',
    install: () => [
      'PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright npx -y playwright@latest install --with-deps chromium firefox webkit',
      'chmod -R a+rwX /opt/ms-playwright',
    ],
    env: () => ({ PLAYWRIGHT_BROWSERS_PATH: '/opt/ms-playwright' }),
  },
  {
    id: 'ffmpeg',
    title: 'ffmpeg',
    category: FactoryMachineCategory.Tool,
    description: 'Audio and video processing',
    abbr: 'ff',
    color: '#0b6b0b',
    textColor: '#ffffff',
    apt: ['ffmpeg'],
  },
  {
    id: 'aws',
    title: 'AWS CLI',
    category: FactoryMachineCategory.Tool,
    description: 'Version 2',
    abbr: 'Aw',
    color: '#ff9900',
    textColor: '#101015',
    apt: ['unzip'],
    install: () => [
      'curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli.zip',
      'unzip -q /tmp/awscli.zip -d /tmp',
      '/tmp/aws/install',
      'rm -rf /tmp/aws /tmp/awscli.zip',
    ],
  },
  {
    id: 'terraform',
    title: 'Terraform',
    category: FactoryMachineCategory.Tool,
    description: 'Infrastructure as code',
    abbr: 'Tf',
    color: '#7b42bc',
    textColor: '#ffffff',
    versions: ['1.15', '1.14'],
    mise: (v) => `terraform@${v}`,
  },
  {
    id: 'kubectl',
    title: 'kubectl',
    category: FactoryMachineCategory.Tool,
    description: 'Kubernetes CLI',
    abbr: 'K8',
    color: '#326ce5',
    textColor: '#ffffff',
    versions: ['1.37', '1.36', '1.35'],
    mise: (v) => `kubectl@${v}`,
  },
];

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

/** What an item needs selected alongside it. */
const REQUIRES: Record<string, string> = { poetry: 'python' };

export const FACTORY_MACHINE_CATALOG: FactoryMachineCatalogItem[] = CATALOG.map(
  ({ mise, install, start, env, apt, path, ...item }) => ({
    ...item,
    isService: !!start,
  })
);

export function factoryMachineRequires(id: string): string | undefined {
  return REQUIRES[id];
}

/**
 * Debian package, npm and pip registry names with an optional version. No
 * quotes or spaces, so {@link quote} holds, and no `:` or `//`, so never a URL,
 * git or file source.
 */
const PACKAGE_NAME =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-zA-Z0-9][a-zA-Z0-9._+-]*(?:(?:@|==|>=|<=|~=|=|<|>)[a-zA-Z0-9._*+~^<>=-]*)?$/;

const quote = (name: string) => `'${name}'`;

const LIMITS = { packages: 100, commands: 50, commandLength: 2000 };

/**
 * Sorted, de-duplicated and trimmed, so the same choices always produce the
 * same spec and the same image hash.
 */
export function canonicalFactoryMachineSpec(
  spec: FactoryMachineSpec
): FactoryMachineSpec {
  const order = new Map(CATALOG.map((entry, i) => [entry.id, i]));
  const seen = new Set<string>();

  const items = (spec.items ?? [])
    .filter((item) => !seen.has(item.id) && seen.add(item.id))
    .map((item) => {
      const entry = BY_ID.get(item.id);
      return entry?.versions?.length
        ? { id: item.id, version: item.version || entry.versions[0] }
        : { id: item.id };
    })
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const names = (list?: string[]) =>
    [...new Set((list ?? []).map((n) => n.trim()).filter(Boolean))].sort();

  return {
    items,
    apt: names(spec.apt),
    npm: names(spec.npm),
    pip: names(spec.pip),
    commands: (spec.commands ?? []).map((c) => c.trim()).filter(Boolean),
  };
}

/**
 * `base` plus `add`. An item in both takes `add`'s version, so a suggestion can
 * move a runtime as well as add one.
 */
export function mergeFactoryMachineSpec(
  base: FactoryMachineSpec | undefined,
  add: FactoryMachineSpec
): FactoryMachineSpec {
  const items = new Map<string, FactoryMachineSelection>();
  for (const item of [...(base?.items ?? []), ...(add.items ?? [])]) {
    items.set(item.id, { ...items.get(item.id), ...item });
  }

  return canonicalFactoryMachineSpec({
    items: [...items.values()],
    apt: [...(base?.apt ?? []), ...(add.apt ?? [])],
    npm: [...(base?.npm ?? []), ...(add.npm ?? [])],
    pip: [...(base?.pip ?? []), ...(add.pip ?? [])],
    commands: [...(base?.commands ?? []), ...(add.commands ?? [])],
  });
}

/** What `add` would change on top of `base`; an empty spec when nothing. */
export function factoryMachineAdditions(
  base: FactoryMachineSpec | undefined,
  add: FactoryMachineSpec
): FactoryMachineSpec {
  const have = canonicalFactoryMachineSpec(base ?? { items: [] });
  const want = canonicalFactoryMachineSpec(add);
  const version = new Map(have.items.map((item) => [item.id, item.version]));
  const missing = (list: string[], owned: string[]) =>
    list.filter((name) => !owned.includes(name));

  return {
    items: want.items.filter(
      (item) => !version.has(item.id) || version.get(item.id) !== item.version
    ),
    apt: missing(want.apt, have.apt),
    npm: missing(want.npm, have.npm),
    pip: missing(want.pip, have.pip),
    commands: missing(want.commands, have.commands),
  };
}

/** The part of `remove` that `base` actually has; empty lists when none of it. */
export function factoryMachineRemovals(
  base: FactoryMachineSpec | undefined,
  remove: FactoryMachineRemoval | undefined
): Required<FactoryMachineRemoval> {
  const have = canonicalFactoryMachineSpec(base ?? { items: [] });
  const owned = (list: string[] | undefined, from: string[]) =>
    [...new Set(list ?? [])].filter((name) => from.includes(name));

  return {
    items: owned(
      remove?.items,
      have.items.map((item) => item.id)
    ),
    apt: owned(remove?.apt, have.apt),
    npm: owned(remove?.npm, have.npm),
    pip: owned(remove?.pip, have.pip),
    commands: owned(remove?.commands, have.commands),
  };
}

/** True when a removal takes nothing off. */
export function isEmptyFactoryMachineRemoval(
  remove: FactoryMachineRemoval | undefined
): boolean {
  return (
    !remove?.items?.length &&
    !remove?.apt?.length &&
    !remove?.npm?.length &&
    !remove?.pip?.length &&
    !remove?.commands?.length
  );
}

/** The machine a suggestion would build: `base`, plus its additions, minus its removals. */
export function applyFactoryMachineSuggestion(
  base: FactoryMachineSpec | undefined,
  suggestion: Pick<FactoryMachineSuggestion, 'add' | 'remove'>
): FactoryMachineSpec {
  const merged = mergeFactoryMachineSpec(base, suggestion.add);
  const remove = suggestion.remove ?? {};
  const keep = (list: string[], drop: string[] | undefined) =>
    list.filter((name) => !(drop ?? []).includes(name));

  return canonicalFactoryMachineSpec({
    items: merged.items.filter((item) => !(remove.items ?? []).includes(item.id)),
    apt: keep(merged.apt ?? [], remove.apt),
    npm: keep(merged.npm ?? [], remove.npm),
    pip: keep(merged.pip ?? [], remove.pip),
    commands: keep(merged.commands ?? [], remove.commands),
  });
}

/** True when a spec selects nothing at all. */
export function isEmptyFactoryMachineSpec(spec: FactoryMachineSpec): boolean {
  return (
    !spec.items?.length &&
    !spec.apt?.length &&
    !spec.npm?.length &&
    !spec.pip?.length &&
    !spec.commands?.length
  );
}

/** Problems that would make the build fail or the spec unsafe; empty when fine. */
export function validateFactoryMachineSpec(spec: FactoryMachineSpec): string[] {
  const errors: string[] = [];
  const s = canonicalFactoryMachineSpec(spec);
  const selected = new Set(s.items.map((item) => item.id));

  for (const item of s.items) {
    const entry = BY_ID.get(item.id);
    if (!entry) {
      errors.push(`Unknown item '${item.id}'`);
      continue;
    }
    if (entry.versions?.length && !entry.versions.includes(item.version)) {
      errors.push(`${entry.title} has no version '${item.version}'`);
    }
    const needs = REQUIRES[item.id];
    if (needs && !selected.has(needs)) {
      errors.push(`${entry.title} needs ${BY_ID.get(needs)?.title}`);
    }
  }

  const lists: [string, string[]][] = [
    ['apt', s.apt],
    ['npm', s.npm],
    ['pip', s.pip],
  ];
  for (const [kind, names] of lists) {
    if (names.length > LIMITS.packages) {
      errors.push(`At most ${LIMITS.packages} ${kind} packages`);
    }
    for (const name of names) {
      if (!PACKAGE_NAME.test(name) || name.length > 214) {
        errors.push(`'${name}' is not a valid ${kind} package name`);
      }
    }
  }
  if (s.pip.length && !selected.has('python')) {
    errors.push('pip packages need Python');
  }

  if (s.commands.length > LIMITS.commands) {
    errors.push(`At most ${LIMITS.commands} custom commands`);
  }
  for (const command of s.commands) {
    if (command.length > LIMITS.commandLength) {
      errors.push(
        `Custom commands are limited to ${LIMITS.commandLength} characters`
      );
    }
    if (command.includes('\\')) {
      errors.push('Custom commands cannot contain a backslash');
    }
  }

  return [...new Set(errors)];
}

const title = (item: FactoryMachineSelection) => {
  const entry = BY_ID.get(item.id);
  return item.version ? `${entry.title} ${item.version}` : entry.title;
};

/** `Node.js 22 · PostgreSQL 16 · +2`, for a chip. Extras and commands count toward the rest. */
export function factoryMachineSummary(
  spec: FactoryMachineSpec,
  max = 3
): string {
  const s = canonicalFactoryMachineSpec(spec);
  const names = s.items.filter((item) => BY_ID.has(item.id)).map(title);
  const rest =
    names.length -
    Math.min(names.length, max) +
    s.apt.length +
    s.npm.length +
    s.pip.length +
    (s.commands.length ? 1 : 0);

  return [...names.slice(0, max), ...(rest ? [`+${rest}`] : [])].join(' · ');
}

/**
 * The image's build steps, in run order. Each command is one root shell line.
 * Assumes a spec that passed {@link validateFactoryMachineSpec}.
 */
export function factoryMachineBuildSteps(
  spec: FactoryMachineSpec
): FactoryMachineBuildStep[] {
  const s = canonicalFactoryMachineSpec(spec);
  const entries = s.items.map((item) => ({
    item,
    entry: BY_ID.get(item.id),
  }));
  const steps: FactoryMachineBuildStep[] = [];
  const hasMise = entries.some(({ entry }) => entry.mise);

  const apt = [
    ...new Set([
      'ca-certificates',
      'curl',
      'gnupg',
      ...entries.flatMap(({ entry }) => entry.apt ?? []),
      ...s.apt.map(quote),
    ]),
  ];
  steps.push({
    id: 'system',
    title: 'System packages',
    detail: s.apt.length ? s.apt.join(' · ') : 'Base packages',
    commands: [
      'apt-get update',
      `DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${apt.join(
        ' '
      )}`,
    ],
  });

  const languages = entries.filter(
    ({ entry }) => entry.category === FactoryMachineCategory.Language
  );
  if (languages.length || hasMise) {
    const mise = entries.filter(({ entry }) => entry.mise);
    steps.push({
      id: 'languages',
      title: 'Languages',
      detail: languages.map(({ item }) => title(item)).join(' · ') || 'mise',
      commands: [
        ...(mise.length
          ? [
              'curl -fsSL https://mise.run | MISE_INSTALL_PATH=/usr/local/bin/mise sh',
              `${MISE_ENV} && mise use -g ${mise
                .map(({ entry, item }) => entry.mise(item.version))
                .join(' ')}`,
              'chmod -R a+rwX /opt/mise',
            ]
          : []),
        ...languages.flatMap(({ entry, item }) =>
          entry.install ? entry.install(item.version) : []
        ),
      ],
    });
  }

  const services = entries.filter(
    ({ entry }) => entry.category === FactoryMachineCategory.Service
  );
  if (services.length) {
    steps.push({
      id: 'services',
      title: 'Services',
      detail: services.map(({ item }) => title(item)).join(' · '),
      commands: services.flatMap(({ entry, item }) =>
        entry.install ? entry.install(item.version) : []
      ),
    });
  }

  const tools = entries.filter(
    ({ entry }) => entry.category === FactoryMachineCategory.Tool
  );
  const toolCommands = tools.flatMap(({ entry, item }) =>
    entry.install ? entry.install(item.version) : []
  );
  if (toolCommands.length) {
    steps.push({
      id: 'tools',
      title: 'Tools',
      detail: tools.map(({ item }) => title(item)).join(' · '),
      commands: toolCommands.map((c) => (hasMise ? `${MISE_ENV} && ${c}` : c)),
    });
  }

  const managers = entries.filter(
    ({ entry }) => entry.category === FactoryMachineCategory.PackageManager
  );
  const packageCommands = [
    ...managers.flatMap(({ entry, item }) =>
      entry.install ? entry.install(item.version) : []
    ),
    ...(s.npm.length ? [`npm install -g ${s.npm.map(quote).join(' ')}`] : []),
    ...(s.pip.length
      ? [`pip install --no-cache-dir ${s.pip.map(quote).join(' ')}`]
      : []),
  ];
  if (packageCommands.length) {
    steps.push({
      id: 'packages',
      title: 'Packages',
      detail: [
        ...managers.map(({ item }) => title(item)),
        ...s.npm,
        ...s.pip,
      ].join(' · '),
      // Through mise's shims, so global installs land in the selected runtime;
      // reshim makes their binaries visible.
      commands: hasMise
        ? [
            ...packageCommands.map((c) => `${MISE_ENV} && ${c}`),
            `${MISE_ENV} && mise reshim && chmod -R a+rwX /opt/mise`,
          ]
        : packageCommands,
    });
  }

  if (s.commands.length) {
    steps.push({
      id: 'custom',
      title: 'Custom commands',
      detail: `${s.commands.length} command${
        s.commands.length === 1 ? '' : 's'
      }`,
      commands: s.commands.map((c) => (hasMise ? `${MISE_ENV} && ${c}` : c)),
    });
  }

  return steps;
}

/** The E2B default PATH; the image's own ENV does not reach commands. */
const BASE_PATH =
  '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

/** What a sandbox started from this environment's image needs at boot. */
export function factoryMachineRuntime(
  spec: FactoryMachineSpec
): FactoryMachineRuntime {
  const s = canonicalFactoryMachineSpec(spec);
  const entries = s.items
    .map((item) => ({ item, entry: BY_ID.get(item.id) }))
    .filter(({ entry }) => entry);

  const path: string[] = [];
  const envs: Record<string, string> = {};

  if (entries.some(({ entry }) => entry.mise)) {
    path.push('/opt/mise/shims');
    Object.assign(envs, {
      MISE_DATA_DIR: '/opt/mise',
      MISE_CONFIG_DIR: '/etc/mise',
      MISE_GLOBAL_CONFIG_FILE: '/etc/mise/config.toml',
    });
  }

  for (const { entry, item } of entries) {
    path.push(...(entry.path ?? []));
    Object.assign(envs, entry.env?.(item.version) ?? {});
  }

  envs.PATH = [...path, BASE_PATH].join(':');

  return {
    envs,
    startCommands: entries
      .filter(({ entry }) => entry.start)
      .map(({ entry, item }) => entry.start(item.version)),
  };
}

/** Repo files {@link detectFactoryMachine} reads, by name at the repository root. */
export const FACTORY_MACHINE_DETECT_FILES = [
  '.nvmrc',
  '.node-version',
  '.tool-versions',
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'deno.json',
  'deno.jsonc',
  '.python-version',
  'pyproject.toml',
  'requirements.txt',
  'uv.lock',
  'poetry.lock',
  'go.mod',
  'Cargo.toml',
  'rust-toolchain.toml',
  'Gemfile',
  '.ruby-version',
  'composer.json',
  'global.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
  'Dockerfile',
  'playwright.config.ts',
  'playwright.config.js',
  'main.tf',
];

/** The newest catalog version a requested one falls under, e.g. `>=20.11` → `20`. */
function nearestVersion(id: string, wanted?: string): string | undefined {
  const versions = BY_ID.get(id)?.versions;
  if (!versions?.length) return undefined;
  const m = wanted?.match(/(\d+)(?:\.(\d+))?/);
  if (!m) return undefined;

  const [major, minor] = [m[1], m[2]];
  return (
    versions.find((v) => minor !== undefined && v === `${major}.${minor}`) ??
    versions.find((v) => v === major) ??
    versions.find((v) => v.split('.')[0] === major)
  );
}

/**
 * Suggest a spec from a repository's root files. `files` maps a file name to
 * its contents; an empty string means present but unread.
 */
export function detectFactoryMachine(
  files: Record<string, string>
): FactoryMachineDetection {
  const found = new Map<string, { version?: string; file: string }>();
  const add = (id: string, file: string, wanted?: string) => {
    if (found.has(id)) return;
    found.set(id, { version: nearestVersion(id, wanted), file });
  };
  const has = (name: string) => files[name] !== undefined;

  const toolVersions = files['.tool-versions'] ?? '';
  const tool = (name: string) =>
    toolVersions.match(new RegExp(`^${name}\\s+(\\S+)`, 'm'))?.[1];

  // Node
  let pkg: {
    engines?: Record<string, string>;
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } = {};
  try {
    pkg = files['package.json'] ? JSON.parse(files['package.json']) : {};
  } catch {
    pkg = {};
  }
  const nodeWanted =
    files['.nvmrc']?.trim() ||
    files['.node-version']?.trim() ||
    tool('nodejs') ||
    tool('node') ||
    pkg.engines?.node;
  if (nodeWanted) {
    add(
      'node',
      has('.nvmrc')
        ? '.nvmrc'
        : has('.node-version')
        ? '.node-version'
        : tool('nodejs') || tool('node')
        ? '.tool-versions'
        : 'package.json',
      nodeWanted
    );
  } else if (has('package.json')) {
    add('node', 'package.json');
  }

  const manager = pkg.packageManager?.match(/^(pnpm|yarn)@(\d+)/);
  if (manager) add(manager[1], 'package.json', manager[2]);
  else if (has('pnpm-lock.yaml')) add('pnpm', 'pnpm-lock.yaml');
  else if (has('yarn.lock')) add('yarn', 'yarn.lock', '1');

  if (has('bun.lock') || has('bun.lockb')) {
    add('bun', has('bun.lock') ? 'bun.lock' : 'bun.lockb');
  }
  if (has('deno.json') || has('deno.jsonc')) {
    add('deno', has('deno.json') ? 'deno.json' : 'deno.jsonc');
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (
    deps['@playwright/test'] ||
    deps.playwright ||
    has('playwright.config.ts') ||
    has('playwright.config.js')
  ) {
    add('playwright', 'package.json');
  }

  // Python
  const pythonWanted =
    files['.python-version']?.trim() ||
    tool('python') ||
    files['pyproject.toml']?.match(
      /requires-python\s*=\s*["'][^0-9]*([0-9.]+)/
    )?.[1];
  if (pythonWanted || has('pyproject.toml') || has('requirements.txt')) {
    add(
      'python',
      has('.python-version')
        ? '.python-version'
        : has('pyproject.toml')
        ? 'pyproject.toml'
        : 'requirements.txt',
      pythonWanted
    );
  }
  if (has('uv.lock')) add('uv', 'uv.lock');
  if (
    has('poetry.lock') ||
    /\[tool\.poetry\]/.test(files['pyproject.toml'] ?? '')
  ) {
    add('poetry', has('poetry.lock') ? 'poetry.lock' : 'pyproject.toml');
  }

  // Others
  if (has('go.mod')) {
    add('go', 'go.mod', files['go.mod'].match(/^go\s+(\d+\.\d+)/m)?.[1]);
  }
  if (has('Cargo.toml') || has('rust-toolchain.toml')) {
    add('rust', has('Cargo.toml') ? 'Cargo.toml' : 'rust-toolchain.toml');
  }
  if (has('Gemfile') || has('.ruby-version')) {
    add(
      'ruby',
      has('.ruby-version') ? '.ruby-version' : 'Gemfile',
      files['.ruby-version']?.trim() || tool('ruby')
    );
  }
  if (has('composer.json')) {
    add(
      'php',
      'composer.json',
      files['composer.json'].match(/"php"\s*:\s*"[^0-9]*([0-9.]+)/)?.[1]
    );
  }
  if (has('global.json')) {
    add(
      'dotnet',
      'global.json',
      files['global.json'].match(/"version"\s*:\s*"(\d+\.\d+)/)?.[1]
    );
  }
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    add(
      'java',
      has('pom.xml') ? 'pom.xml' : 'build.gradle',
      tool('java')?.replace(/^[a-z-]+/, '')
    );
  }
  if (has('main.tf')) add('terraform', 'main.tf');

  // Services named in a compose file
  const composeFile = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
  ].find(has);
  const compose = composeFile ? files[composeFile] : '';
  const image = (name: string) =>
    compose.match(
      new RegExp(`image:\\s*["']?(?:[\\w./-]*/)?${name}:?([\\w.-]*)`)
    )?.[1];
  for (const [id, name] of [
    ['postgres', 'postgres'],
    ['postgres', 'postgis'],
    ['mysql', 'mysql'],
    ['redis', 'redis'],
    ['mongo', 'mongo'],
  ]) {
    const tag = image(name);
    if (tag !== undefined) add(id, composeFile, tag);
  }

  if (has('Dockerfile') || composeFile)
    add('docker', composeFile ?? 'Dockerfile');

  const items = [...found.entries()].map(([id, { version }]) => ({
    id,
    ...(version ? { version } : {}),
  }));

  return {
    spec: canonicalFactoryMachineSpec({ items }),
    reasons: [...found.entries()].map(([id, { file }]) => ({ id, file })),
  };
}
