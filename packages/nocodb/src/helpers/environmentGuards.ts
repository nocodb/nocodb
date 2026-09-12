import type { NcContext, NcRequest } from '~/interface/config';

// CE no-op stubs. Environment lanes are an EE feature; EE overrides these with
// the real impl in `src/ee/helpers/environmentGuards.ts`.

export async function assertNotLaneInstance(
  _context: NcContext,
  _message?: string,
): Promise<void> {}

export async function assertNotLaneProduction(
  _context: NcContext,
  _message?: string,
): Promise<void> {}

export async function assertNotLaneRelated(
  _context: NcContext,
  _message?: string,
): Promise<void> {}

export async function assertNotLockedViewOnLaneProduction(
  _context: NcContext,
  _viewId: string,
  _message?: string,
): Promise<void> {}

export async function clearLaneCreatingState(
  _context: NcContext,
  _baseId: string,
): Promise<void> {}

export async function isLaneTeardownInProgress(
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
): Promise<{ context: NcContext; baseId: string; instance: null }> {
  return { context, baseId, instance: null };
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
