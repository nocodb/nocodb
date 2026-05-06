import { ViewLockType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Sandbox, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { isReplay } from '~/helpers/replayScope';

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
 * Skipped automatically during sandbox merge / undo-redo replay (`isReplay()`).
 */
export async function assertNotSandboxProduction(
  context: NcContext,
  message = 'This operation is not allowed while a sandbox is active. Make the change in the sandbox instead.',
): Promise<void> {
  if (isReplay()) return;
  const sandboxes = await Sandbox.listByProductionBaseId(context.base_id);
  if (sandboxes.length > 0) {
    NcError.get(context).sandboxProductionBlocked(message);
  }
}

/**
 * Throws if the target view is locked AND the base has an active sandbox.
 * Mirrors `views.service.ts viewUpdate` — locked views are frozen on
 * production while a sandbox is active so changes flow through the sandbox.
 * Personal and collaborative (non-locked) views are unaffected.
 */
export async function assertNotLockedViewOnSandboxProduction(
  context: NcContext,
  viewId: string,
  message = 'Locked views cannot be modified on a base with an active sandbox. Make changes in the sandbox.',
): Promise<void> {
  if (isReplay()) return;
  if (!viewId) return;
  const view = await View.get(context, viewId);
  if (view?.lock_type !== ViewLockType.Locked) return;
  await assertNotSandboxProduction(context, message);
}
