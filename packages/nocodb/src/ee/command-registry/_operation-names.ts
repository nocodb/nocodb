/**
 * Stable string identifiers for traced operations. Decoupled from method
 * names so a method rename does not silently break the registry key.
 *
 * Add an entry per contract in this file's order — alphabetical by domain.
 */
export const OperationNames = {
  // populated as contracts land
} as const;

export type OperationName = (typeof OperationNames)[keyof typeof OperationNames];
