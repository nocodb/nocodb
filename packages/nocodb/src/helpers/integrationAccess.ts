import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { resolveAccessBaseId } from '~/helpers/environmentGuards';
import { Integration, IntegrationLink } from '~/models';

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
 * A restricted integration may back a source only in a base linked to it.
 * `baseId` null is a base being created, which has no links yet.
 * Mirrors the availability check in base-integrations.service.ts.
 */
export async function assertIntegrationAvailableToBase(
  context: Pick<NcContext, 'workspace_id' | 'api_version'>,
  integration: Pick<Integration, 'id' | 'is_restricted'> & {
    is_global?: BoolType;
  },
  baseId: string | null,
): Promise<void> {
  if (!integration.is_restricted || integration.is_global) return;

  if (baseId) {
    const baseContext: NcContext = {
      workspace_id: context.workspace_id,
      base_id: baseId,
      api_version: context.api_version,
    };
    const isAvailable = await IntegrationLink.isAvailable(baseContext, {
      fk_integration_id: integration.id,
      base_id: await resolveAccessBaseId(baseContext, baseId),
      is_restricted: true,
    });
    if (isAvailable) return;
  }

  NcError.get(context).badRequest('Integration is not available to this base.');
}

/**
 * Resolves a client-supplied integration id for a source to reference: it
 * must belong to the caller's workspace and not be someone else's private one.
 * Not-found either way, so the id's existence is not confirmed. It must also
 * be available to `baseId` (see assertIntegrationAvailableToBase).
 */
export async function getIntegrationForSource(
  context: Pick<NcContext, 'workspace_id' | 'api_version'>,
  integrationId: string,
  userId: string | null | undefined,
  baseId: string | null,
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

  await assertIntegrationAvailableToBase(context, integration, baseId);

  return integration;
}
