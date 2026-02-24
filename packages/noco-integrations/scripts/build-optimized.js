import { execSync } from 'child_process';
import { createHash } from 'crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';

const CHECKSUM_FILE = '.build-checksums.json';
const WORKSPACE_PACKAGES = buildDependencyOrder(['core', ...getPackages()]);

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
        name.startsWith('@noco-integrations/') && String(version).startsWith('workspace:'),
      )
      .map(([name]) => name.replace('@noco-integrations/', ''));
  } catch {
    return [];
  }
}

/**
 * Returns packages sorted so that every dependency is built before the package
 * that depends on it (topological order). Packages with no intra-workspace deps
 * retain their discovery order (i.e. 'core' still comes first).
 */
function buildDependencyOrder(packages) {
  // Map short-name → full path ("smtp-auth" → "packages/smtp-auth", "core" → "core")
  const nameToPath = new Map();
  for (const pkg of packages) {
    const shortName = pkg === 'core' ? 'core' : pkg.replace('packages/', '');
    nameToPath.set(shortName, pkg);
  }

  const visited = new Set();
  const visiting = new Set(); // cycle detection
  const result = [];

  function visit(pkgPath) {
    if (visited.has(pkgPath)) return;
    if (visiting.has(pkgPath)) {
      console.warn(`⚠️  Circular dependency detected involving ${pkgPath}, skipping`);
      return;
    }
    visiting.add(pkgPath);

    for (const depName of getWorkspaceDependencies(pkgPath)) {
      const depPath = nameToPath.get(depName);
      if (depPath) visit(depPath);
    }

    visiting.delete(pkgPath);
    visited.add(pkgPath);
    result.push(pkgPath);
  }

  for (const pkg of packages) {
    visit(pkg);
  }
  return result;
}

function getAllFiles(dir, files = []) {
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip node_modules and dist directories
        if (
          item !== 'node_modules' &&
          item !== 'dist' &&
          !item.startsWith('.')
        ) {
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

    // Sort files for consistent ordering across platforms
    files.sort();

    for (const file of files) {
      try {
        // Add the relative file path to the hash for structure consistency
        const relativePath = file.replace(packagePath, '').replace(/\\/g, '/');
        hash.update(relativePath);

        // Add the file contents
        const content = readFileSync(file);
        hash.update(content);
      } catch {
        // Skip files we can't read
      }
    }

    return hash.digest('hex');
  } catch (error) {
    console.error(
      `Error calculating checksum for ${packagePath}:`,
      error.message,
    );
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

function buildPackage(packagePath) {
  console.log(`📦 Building ${packagePath}...`);
  try {
    execSync('pnpm build', { cwd: packagePath, stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`❌ Failed to build ${packagePath}:`, error.message);
    return false;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  const verbose = process.argv.includes('--verbose');

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
      console.log(
        `⚠️  Could not calculate checksum for ${packagePath}, skipping...`,
      );
      continue;
    }

    newChecksums[packagePath] = currentChecksum;

    const oldChecksum = oldChecksums[packagePath];
    const hasChanged = oldChecksum !== currentChecksum;
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

  console.log(`\n🚀 Building ${packagesNeedingBuild.length} package(s)...`);

  let successCount = 0;
  let failCount = 0;

  for (const packagePath of packagesNeedingBuild) {
    if (buildPackage(packagePath)) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // Save checksums only for successfully built packages
  if (successCount > 0) {
    saveChecksums(newChecksums);
    console.log(`\n✅ Successfully built ${successCount} package(s)`);
  }

  if (failCount > 0) {
    console.log(`❌ Failed to build ${failCount} package(s)`);
    process.exit(1);
  }

  console.log('🎯 Build optimization complete!');
}

// Handle CLI arguments
if (process.argv.includes('--help')) {
  console.log(`
Usage: node scripts/build-optimized.js [options]

Options:
  --force     Force rebuild all packages regardless of changes
  --verbose   Show detailed output for all packages
  --help      Show this help message

Examples:
  node scripts/build-optimized.js          # Build only changed packages
  node scripts/build-optimized.js --force  # Force rebuild all packages
  node scripts/build-optimized.js --verbose # Show detailed output
`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Build script failed:', error.message);
  process.exit(1);
});
