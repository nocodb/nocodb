import { Injectable, Logger } from '@nestjs/common';
import type { IntegrationReqType, IntegrationsType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, Integration, IntegrationLink } from '~/models';
import { NcError } from '~/helpers/catchError';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { IntegrationsService } from '~/services/integrations.service';

@Injectable()
export class BaseIntegrationsService {
  protected logger = new Logger(BaseIntegrationsService.name);

  constructor(protected integrationsService: IntegrationsService) {}

  /**
   * List integrations available to a base.
   * Returns integrations that:
   *   - is_restricted = false (unrestricted / legacy), OR
   *   - Have an explicit link to this base, OR
   *   - Are global (env var)
   */
  async listForBase(
    context: NcContext,
    param: {
      baseId: string;
      type?: IntegrationsType;
      subType?: string;
    },
  ) {
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    const workspaceId = base.fk_workspace_id;

    const knex = Noco.ncMeta.knex;
    const integrations = await knex(MetaTable.INTEGRATIONS)
      .select(
        `${MetaTable.INTEGRATIONS}.id`,
        `${MetaTable.INTEGRATIONS}.title`,
        `${MetaTable.INTEGRATIONS}.type`,
        `${MetaTable.INTEGRATIONS}.sub_type`,
        `${MetaTable.INTEGRATIONS}.is_private`,
        `${MetaTable.INTEGRATIONS}.is_global`,
        `${MetaTable.INTEGRATIONS}.is_restricted`,
        `${MetaTable.INTEGRATIONS}.created_by`,
        `${MetaTable.INTEGRATIONS}.meta`,
      )
      .where(`${MetaTable.INTEGRATIONS}.fk_workspace_id`, workspaceId)
      .where(`${MetaTable.INTEGRATIONS}.deleted`, false)
      .modify((qb) => {
        if (param.type) {
          qb.where(`${MetaTable.INTEGRATIONS}.type`, param.type);
        }
        if (param.subType) {
          qb.where(`${MetaTable.INTEGRATIONS}.sub_type`, param.subType);
        }
      });

    // Get integration IDs explicitly linked to this base
    const linkedIntegrationIds = await knex(MetaTable.INTEGRATION_LINKS)
      .select('fk_integration_id')
      .where('base_id', param.baseId)
      .then((rows) => new Set(rows.map((r) => r.fk_integration_id)));

    // Filter: available if unrestricted OR explicitly linked OR global
    return integrations.filter((integration) => {
      if (integration.is_global) return true;
      if (!integration.is_restricted) return true;
      return linkedIntegrationIds.has(integration.id);
    });
  }


  /**
   * Create an integration from a base context.
   * The integration is workspace-level but marked as restricted
   * and auto-linked to this base only.
   */
  async createFromBase(
    context: NcContext,
    param: {
      baseId: string;
      integration: IntegrationReqType;
      req: NcRequest;
    },
  ) {
    const workspaceId = context.workspace_id;
    const userId = param.req.user?.id;

    if (!workspaceId) {
      NcError.get(context).badRequest('Workspace ID is required');
    }

    // Create integration at workspace level with is_restricted = true
    const integration = await Integration.createIntegration({
      ...param.integration,
      fk_workspace_id: workspaceId,
      created_by: userId,
      is_restricted: true,
    } as any);

    // Auto-link to this base
    await IntegrationLink.insert(context, {
      fk_integration_id: integration.id,
      base_id: param.baseId,
      fk_workspace_id: workspaceId,
      created_by: userId,
    });

    return integration;
  }

  /**
   * Update an integration from a base context.
   * Only the creator of the integration can update it.
   */
  async updateFromBase(
    context: NcContext,
    param: {
      baseId: string;
      integrationId: string;
      integration: IntegrationReqType;
      req: NcRequest;
    },
  ) {
    const integration = await Integration.get(context, param.integrationId);
    if (!integration) {
      NcError.get(context).integrationNotFound(param.integrationId);
    }

    // Only the creator can update from base context
    if (integration.created_by !== param.req.user?.id) {
      NcError.get(context).unauthorized(
        'Only the creator can update this integration.',
      );
    }

    // Verify integration is available to this base
    const isAvailable = await IntegrationLink.isAvailable(context, {
      fk_integration_id: param.integrationId,
      base_id: param.baseId,
      is_restricted: !!integration.is_restricted,
    });

    if (!isAvailable) {
      NcError.get(context).badRequest(
        'Integration is not available to this base.',
      );
    }

    return this.integrationsService.integrationUpdate(context, {
      integrationId: param.integrationId,
      integration: param.integration,
      req: param.req,
    });
  }

  /**
   * Link an existing integration to a base.
   */
  async link(
    context: NcContext,
    param: {
      baseId: string;
      integrationId: string;
      userId: string;
    },
  ) {
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    const integration = await Integration.get(context, param.integrationId);
    if (!integration) {
      NcError.get(context).integrationNotFound(param.integrationId);
    }

    // Verify integration belongs to the same workspace
    if (integration.fk_workspace_id !== base.fk_workspace_id) {
      NcError.get(context).badRequest(
        'Integration does not belong to this workspace.',
      );
    }

    // Check visibility: private integrations can only be linked by their creator
    if (integration.is_private && integration.created_by !== param.userId) {
      NcError.get(context).badRequest(
        'Cannot link a private integration created by another user.',
      );
    }

    // Check if already linked
    const links = await IntegrationLink.listByIntegration(
      context,
      param.integrationId,
    );
    if (links.some((l) => l.base_id === param.baseId)) {
      return { linked: true };
    }

    await IntegrationLink.insert(context, {
      fk_integration_id: param.integrationId,
      base_id: param.baseId,
      fk_workspace_id: base.fk_workspace_id,
      created_by: param.userId,
    });

    return { linked: true };
  }

  /**
   * Unlink an integration from a base.
   */
  async unlink(
    context: NcContext,
    param: {
      baseId: string;
      integrationId: string;
    },
  ) {
    const deleted = await IntegrationLink.deleteByIntegrationAndBase(
      context,
      param.integrationId,
      param.baseId,
    );

    if (!deleted) {
      NcError.get(context).badRequest(
        'Integration is not linked to this base.',
      );
    }

    return { unlinked: true };
  }

  /**
   * List bases linked to a specific integration.
   * (Workspace-admin endpoint)
   */
  async linkedBaseList(
    context: NcContext,
    param: {
      integrationId: string;
    },
  ) {
    const integration = await Integration.get(context, param.integrationId);
    if (!integration) {
      NcError.get(context).integrationNotFound(param.integrationId);
    }

    if (!integration.is_restricted) {
      return { all_bases: true, bases: [] };
    }

    const links = await IntegrationLink.listByIntegration(
      context,
      param.integrationId,
    );

    const bases = [];
    for (const link of links) {
      const base = await Base.get(context, link.base_id);
      if (base) {
        bases.push({ id: base.id, title: base.title });
      }
    }

    return { all_bases: false, bases };
  }

  /**
   * Replace base assignments for an integration.
   * (Workspace-admin endpoint)
   *
   * - { all_bases: true } → set is_restricted = false, delete all links
   * - { base_ids: [...] } → set is_restricted = true, replace links
   */
  async updateLinkedBases(
    context: NcContext,
    param: {
      integrationId: string;
      allBases?: boolean;
      baseIds?: string[];
      userId: string;
    },
  ) {
    const integration = await Integration.get(context, param.integrationId);
    if (!integration) {
      NcError.get(context).integrationNotFound(param.integrationId);
    }

    if (param.allBases) {
      // Delete all links + set unrestricted
      await IntegrationLink.deleteByIntegration(
        context,
        param.integrationId,
      );
      await Integration.updateIntegration(context, param.integrationId, {
        is_restricted: false,
      } as any);
      return { all_bases: true };
    }

    if (param.baseIds) {
      // Set restricted + replace links
      await Integration.updateIntegration(context, param.integrationId, {
        is_restricted: true,
      } as any);
      await IntegrationLink.replaceLinksForIntegration(context, {
        integrationId: param.integrationId,
        baseIds: param.baseIds,
        workspaceId: integration.fk_workspace_id,
        userId: param.userId,
      });
      return { all_bases: false, base_ids: param.baseIds };
    }

    NcError.get(context).badRequest(
      'Either all_bases or base_ids must be provided.',
    );
  }
}
