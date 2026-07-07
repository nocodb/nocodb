import type { NcContext, NcRequest } from '~/interface/config';

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

export async function resolveAccessBaseId(
  _context: NcContext,
  baseId: string,
): Promise<string> {
  return baseId;
}

export async function resolveAccessContext(
  context: NcContext,
  baseId: string,
): Promise<{ context: NcContext; baseId: string; sandbox: null }> {
  return { context, baseId, sandbox: null };
}

export async function resolveEnvironmentForBase(
  context: NcContext,
  baseId: string,
): Promise<{ context: NcContext; baseId: string; environmentId: null }> {
  return { context, baseId, environmentId: null };
}

export async function assertResolvedBaseAcl(
  _context: NcContext,
  _req: NcRequest,
  _operation: string,
): Promise<void> {}
