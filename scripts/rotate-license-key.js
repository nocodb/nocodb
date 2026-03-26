#!/usr/bin/env node

/**
 * Generate a new RSA key pair for license JWT signing/verification.
 *
 * What it does:
 *   1. Generates a 2048-bit RSA key pair
 *   2. Prepends the new public key to LICENSE_SERVER_PUBLIC_KEYS in
 *      packages/nocodb/src/ee/utils/license/constants.ts
 *   3. Prints the private key for the server's NC_LICENSE_SERVER_PRIVATE_KEY env var
 *
 * Usage:
 *   node scripts/rotate-license-key.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONSTANTS_PATH = path.resolve(
  __dirname,
  '../packages/nocodb/src/ee/utils/license/constants.ts',
);

// Generate RSA 2048-bit key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Read current constants file
const contents = fs.readFileSync(CONSTANTS_PATH, 'utf8');

// Find the array opening and prepend the new key
const marker = 'export const LICENSE_SERVER_PUBLIC_KEYS: string[] = [';
const idx = contents.indexOf(marker);
if (idx === -1) {
  console.error(
    'ERROR: Could not find LICENSE_SERVER_PUBLIC_KEYS array in constants.ts',
  );
  process.exit(1);
}

const insertAt = idx + marker.length;
const date = new Date().toISOString().slice(0, 10);
const newEntry = `\n  // Added ${date}\n  \`${publicKey.trim()}\`,`;
const updated = contents.slice(0, insertAt) + newEntry + contents.slice(insertAt);

fs.writeFileSync(CONSTANTS_PATH, updated, 'utf8');

console.log('=== New public key prepended to LICENSE_SERVER_PUBLIC_KEYS ===\n');
console.log(publicKey);
console.log('=== Set this as NC_LICENSE_SERVER_PRIVATE_KEY on the server ===\n');
console.log(privateKey);
