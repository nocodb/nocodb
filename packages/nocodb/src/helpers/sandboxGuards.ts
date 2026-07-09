import type { NcContext } from '~/interface/config';

// CE no-op stubs. Sandboxes are an EE feature; EE overrides these with
// the real impl in `src/ee/helpers/sandboxGuards.ts`.

export async function assertNotSandbox(
  _context: NcContext,
  _message?: string,
): Promise<void> {}

export async function assertNotSandboxProduction(
  _context: NcContext,
  _message?: string,
): Promise<void> {}

export async function assertNotSandboxRelated(
  _context: NcContext,
  _message?: string,
): Promise<void> {}

export async function assertNotLockedViewOnSandboxProduction(
  _context: NcContext,
  _viewId: string,
  _message?: string,
): Promise<void> {}

export async function clearSandboxCreatingState(
  _context: NcContext,
  _baseId: string,
): Promise<void> {}

export async function isSandboxTeardownInProgress(
  _context: NcContext,
  _baseId: string,
): Promise<boolean> {
  return false;
}
