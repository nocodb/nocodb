import * as fs from 'fs';
import * as path from 'path';

// Extensions Root
const rootPath = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'nc-gui',
  'extensions',
);

/**
 * Get the root path of the extensions
 * @returns The root path of the extensions
 */
export function getExtensionRootPath() {
  return rootPath;
}

/**
 * Get the minimum access role of an extension
 * @param extensionEntry The entry of the extension
 * @param fallbackRole The fallback role if the extension does not have a minAccessRole
 * @returns The minimum access role of the extension
 */
export function getExtensionMinAccessRole(
  extensionEntry: string,
  fallbackRole: string = 'creator',
) {
  // If no extension entry is provided, return the fallback role
  if (!extensionEntry) return fallbackRole;

  // Get the manifest path of the extension
  const manifestPath = path.resolve(
    getExtensionRootPath(),
    extensionEntry,
    'manifest.json',
  );

  // Try to get the minAccessRole from the manifest
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest?.minAccessRole || fallbackRole;
  } catch {
    // If the manifest is not found, return the fallback role
    return fallbackRole;
  }
}
