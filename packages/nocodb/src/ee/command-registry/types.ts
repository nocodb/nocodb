// EE re-exports the CE shared types unchanged. Use the explicit `src/...`
// path (not `~/...`) to avoid circular re-export under EE path resolution
// (`~/*` resolves to `src/ee/*` first → loops back to this file).
// Add EE-only extensions here as needed in later tasks.
export * from 'src/command-registry/types';
