import { spawn } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { cpus } from 'os';

const CHECKSUM_FILE = '.build-checksums.json';
const ALL_PACKAGES = ['core', ...getPackages()];
const BUILD_LEVELS = computeBuildLevels(ALL_PACKAGES);
// Flatten levels → stable iteration order for checksum checks
const WORKSPACE_PACKAGES = BUILD_LEVELS.flat();

function getPackages() {
  try {
    const packagesDir = resolve('packages');
    if (!existsSync(packagesDir)) {
      return [];
    }
    const packages = readdirSync(packagesDir).filter((name) => {
      const packagePath = join(packagesDir, name);
      return statSync(packagePath).isDirectory() && !name.startsWith('.');
    });
    return packages.map((name) => `packages/${name}`);
  } catch (error) {
    console.error('Error reading packages directory:', error.message);
    return [];
  }
}

/**
 * Returns the @noco-integrations/* workspace dependency short-names for a package.
 * e.g. { "@noco-integrations/smtp-auth": "workspace:*" } → ["smtp-auth"]
 */
function getWorkspaceDependencies(packagePath) {
  const pkgJsonPath = join(packagePath, 'package.json');
  if (!existsSync(pkgJsonPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return Object.entries(allDeps)
      .filter(([name, version]) =>
        name.startsWith('@noco-integrations/') &&
        String(version).startsWith('workspace:'),
      )
      .map(([name]) => name.replace('@noco-integrations/', ''));
  } catch {
    return [];
  }
}

/**
 * Returns packages grouped into build levels via BFS.
 * All packages within a level have no unbuilt dependencies — they can be built
 * in parallel. Level N finishes completely before level N+1 starts.
 *
 * Example with 60 packages all depending only on core:
 *   Level 0: [core]
 *   Level 1: [all-60-packages]   ← built in parallel
 */
function computeBuildLevels(packages) {
  const nameToPath = new Map();
  for (const pkg of packages) {
    const shortName = pkg === 'core' ? 'core' : pkg.replace('packages/', '');
    nameToPath.set(shortName, pkg);
  }

  const inDegree = new Map();
  const dependents = new Map();
  for (const pkg of packages) {
    inDegree.set(pkg, 0);
    dependents.set(pkg, []);
  }
  for (const pkg of packages) {
    for (const depName of getWorkspaceDependencies(pkg)) {
      const depPath = nameToPath.get(depName);
      if (depPath) {
        inDegree.set(pkg, inDegree.get(pkg) + 1);
        dependents.get(depPath).push(pkg);
      }
    }
  }

  const levels = [];
  const placed = new Set();
  let current = packages.filter((pkg) => inDegree.get(pkg) === 0);
  current.forEach((pkg) => placed.add(pkg));

  while (current.length > 0) {
    levels.push([...current]);
    const next = [];
    for (const pkg of current) {
      for (const dep of dependents.get(pkg) || []) {
        inDegree.set(dep, inDegree.get(dep) - 1);
        if (inDegree.get(dep) === 0 && !placed.has(dep)) {
          next.push(dep);
          placed.add(dep);
        }
      }
    }
    current = next;
  }

  // Any unplaced packages have a cycle — build them last with a warning
  const remaining = packages.filter((pkg) => !placed.has(pkg));
  if (remaining.length > 0) {
    console.warn(
      `⚠️  Cycle detected, building last: ${remaining.join(', ')}`,
    );
    levels.push(remaining);
  }

  return levels;
}

function getAllFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (item !== 'node_modules' && item !== 'dist' && !item.startsWith('.')) {
          getAllFiles(fullPath, files);
        }
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return files;
}

function calculateChecksum(packagePath) {
  try {
    if (!existsSync(packagePath)) {
      return null;
    }

    const files = getAllFiles(packagePath);
    const hash = createHash('sha256');
    files.sort();

    for (const file of files) {
      try {
        const relativePath = file.replace(packagePath, '').replace(/\\/g, '/');
        hash.update(relativePath);
        hash.update(readFileSync(file));
      } catch {
        // Skip files we can't read
      }
    }

    return hash.digest('hex');
  } catch (error) {
    console.error(`Error calculating checksum for ${packagePath}:`, error.message);
    return null;
  }
}

function loadChecksums() {
  if (!existsSync(CHECKSUM_FILE)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(CHECKSUM_FILE, 'utf8'));
  } catch (error) {
    console.warn('Error reading checksum file, starting fresh:', error.message);
    return {};
  }
}

function saveChecksums(checksums) {
  try {
    writeFileSync(CHECKSUM_FILE, JSON.stringify(checksums, null, 2));
  } catch (error) {
    console.error('Error saving checksums:', error.message);
  }
}

function packageExists(packagePath) {
  return (
    existsSync(packagePath) && existsSync(join(packagePath, 'package.json'))
  );
}

function hasDistFolder(packagePath) {
  return existsSync(join(packagePath, 'dist'));
}

/**
 * Builds a single package asynchronously. Output is buffered and printed
 * atomically when the process exits so parallel builds don't interleave.
 */
function buildPackageAsync(packagePath) {
  return new Promise((resolve) => {
    const proc = spawn('pnpm', ['build'], {
      cwd: packagePath,
      shell: process.platform === 'win32',
    });

    const chunks = [];
    proc.stdout?.on('data', (d) => chunks.push({ stream: 'out', d }));
    proc.stderr?.on('data', (d) => chunks.push({ stream: 'err', d }));

    proc.on('close', (code) => {
      const success = code === 0;
      if (success) {
        console.log(`  ✅ ${packagePath}`);
      } else {
        console.error(`  ❌ ${packagePath} (exit ${code})`);
        if (chunks.length) {
          console.error(`  --- output for ${packagePath} ---`);
          for (const { stream, d } of chunks) {
            (stream === 'out' ? process.stdout : process.stderr).write(d);
          }
          console.error(`  --- end ${packagePath} ---`);
        }
      }
      resolve(success);
    });

    proc.on('error', (err) => {
      console.error(`  ❌ ${packagePath}: spawn error — ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Builds an array of packages in parallel, capped at maxConcurrent workers.
 * Returns { successCount, failCount }.
 */
async function buildLevel(packages, maxConcurrent) {
  const queue = [...packages];
  let successCount = 0;
  let failCount = 0;

  async function worker() {
    while (queue.length > 0) {
      const pkg = queue.shift();
      if (!pkg) break;
      if (await buildPackageAsync(pkg)) {
        successCount++;
      } else {
        failCount++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, packages.length) }, worker),
  );

  return { successCount, failCount };
}

async function main() {
  const force = process.argv.includes('--force');
  const verbose = process.argv.includes('--verbose');
  const concurrencyArg = process.argv.find((a) => a.startsWith('--concurrency='));
  const maxConcurrent = concurrencyArg
    ? Math.max(1, parseInt(concurrencyArg.split('=')[1], 10))
    : cpus().length;

  if (force) {
    console.log('🔄 Force rebuild requested, building all packages...');
  }

  const oldChecksums = loadChecksums();
  const newChecksums = {};
  const packagesNeedingBuild = [];

  console.log('🔍 Checking package changes...');

  for (const packagePath of WORKSPACE_PACKAGES) {
    if (!packageExists(packagePath)) {
      if (verbose) {
        console.log(`⚠️  Package ${packagePath} does not exist, skipping...`);
      }
      continue;
    }

    const currentChecksum = calculateChecksum(packagePath);
    if (!currentChecksum) {
      console.log(`⚠️  Could not calculate checksum for ${packagePath}, skipping...`);
      continue;
    }

    newChecksums[packagePath] = currentChecksum;

    const hasChanged = oldChecksums[packagePath] !== currentChecksum;
    const missingDist = !hasDistFolder(packagePath);

    if (force || hasChanged || missingDist) {
      const reason = force ? 'forced' : hasChanged ? 'changed' : 'missing dist';
      if (verbose || hasChanged || missingDist) {
        console.log(`📋 ${packagePath} needs build (${reason})`);
      }
      packagesNeedingBuild.push(packagePath);
    } else if (verbose) {
      console.log(`✅ ${packagePath} unchanged, skipping build`);
    }
  }

  if (packagesNeedingBuild.length === 0) {
    console.log('🎉 All packages are up to date, no builds needed!');
    return;
  }

  const packagesNeedingBuildSet = new Set(packagesNeedingBuild);
  console.log(
    `\n🚀 Building ${packagesNeedingBuild.length} package(s) (up to ${maxConcurrent} parallel)...`,
  );

  let totalSuccess = 0;
  let totalFail = 0;

  for (let i = 0; i < BUILD_LEVELS.length; i++) {
    const toBuild = BUILD_LEVELS[i].filter((pkg) =>
      packagesNeedingBuildSet.has(pkg),
    );
    if (toBuild.length === 0) continue;

    console.log(
      `\n⚡ Level ${i} — ${toBuild.length} package(s) in parallel`,
    );
    if (verbose) {
      console.log(`   ${toBuild.join(', ')}`);
    }

    const { successCount, failCount } = await buildLevel(toBuild, maxConcurrent);
    totalSuccess += successCount;
    totalFail += failCount;

    if (failCount > 0) {
      console.error(
        `\n❌ ${failCount} package(s) failed in level ${i} — stopping build`,
      );
      process.exit(1);
    }
  }

  if (totalSuccess > 0) {
    saveChecksums(newChecksums);
    console.log(`\n✅ Successfully built ${totalSuccess} package(s)`);
  }

  if (totalFail > 0) {
    console.log(`❌ Failed to build ${totalFail} package(s)`);
    process.exit(1);
  }

  console.log('🎯 Build optimization complete!');
}

if (process.argv.includes('--help')) {
  console.log(`
Usage: node scripts/build-optimized.js [options]

Options:
  --force              Force rebuild all packages regardless of changes
  --verbose            Show detailed output for all packages
  --concurrency=N      Max parallel builds per level (default: CPU count)
  --help               Show this help message

Examples:
  node scripts/build-optimized.js                    # Build only changed packages
  node scripts/build-optimized.js --force            # Force rebuild all
  node scripts/build-optimized.js --concurrency=4   # Limit to 4 parallel
  node scripts/build-optimized.js --verbose          # Show per-package details
`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Build script failed:', error.message);
  process.exit(1);
});
