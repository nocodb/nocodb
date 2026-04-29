import type { NcContext } from '~/interface/config';
import { Sandbox } from '~/models';
import { NcError } from '~/helpers/catchError';

/**
 * Throws if the current context's base is a sandbox base.
 * Use before any operation that must only run on production bases.
 */
export async function assertNotSandbox(
  context: NcContext,
  message = 'This operation is not allowed in a sandbox base. Perform it on the production base instead.',
): Promise<void> {
  const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
  if (sandbox) {
    NcError.get(context).sandboxBlocked(message);
  }
}

/**
 * Throws if the current context's base is a sandbox production base (i.e. has
 * an active sandbox derived from it). Use before schema-mutation operations
 * that should only run in the sandbox.
 * Skipped automatically during sandbox merge replay (context.additionalContext.is_replay).
 */
export async function assertNotSandboxProduction(
  context: NcContext,
  message = 'This operation is not allowed while a sandbox is active. Make the change in the sandbox instead.',
): Promise<void> {
  if (context.additionalContext?.is_replay) return;
  const sandboxes = await Sandbox.listByProductionBaseId(context.base_id);
  if (sandboxes.length > 0) {
    NcError.get(context).sandboxProductionBlocked(message);
  }
}
