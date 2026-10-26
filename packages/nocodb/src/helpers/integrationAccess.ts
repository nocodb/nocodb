import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Integration } from '~/models';

/**
 * A private integration's decrypted connection config may only be read or
 * cloned by its creator. Mirrors the ownership check in
 * base-integrations.service.ts.
 *
 * @returns true when access must be denied.
 */
export function isPrivateIntegrationForbidden(
  isPrivate: boolean | null | undefined,
  createdBy: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!isPrivate) return false;
  return createdBy !== userId;
}

/**
 * Resolves a client-supplied integration id for a source to reference: it
 * must belong to the caller's workspace and not be someone else's private one.
 * Not-found either way, so the id's existence is not confirmed.
 */
export async function getIntegrationForSource(
  context: Pick<NcContext, 'workspace_id' | 'api_version'>,
  integrationId: string,
  userId: string | null | undefined,
): Promise<Integration> {
  const integration = await Integration.get(context, integrationId);

  if (
    !integration ||
    (integration.fk_workspace_id &&
      context.workspace_id &&
      integration.fk_workspace_id !== context.workspace_id) ||
    isPrivateIntegrationForbidden(
      !!integration.is_private,
      integration.created_by,
      userId,
    )
  ) {
    NcError.get(context).integrationNotFound(integrationId);
  }

  return integration;
}
