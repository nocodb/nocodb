import { Injectable, Logger } from '@nestjs/common';
import { IntegrationsType as IntegrationsTypeEnum } from 'nocodb-sdk';
import type { IntegrationReqType, IntegrationsType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { Base, Integration, IntegrationLink } from '~/models';
import { NcBaseError, NcError } from '~/helpers/catchError';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { IntegrationsService } from '~/services/integrations.service';
import { maskKnexConfig } from '~/helpers/responseHelpers';

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
      userId?: string;
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
        `${MetaTable.INTEGRATIONS}.created_at`,
      )
      .where(`${MetaTable.INTEGRATIONS}.fk_workspace_id`, workspaceId)
      .where((qb) => {
        qb.where(`${MetaTable.INTEGRATIONS}.deleted`, false).orWhereNull(
          `${MetaTable.INTEGRATIONS}.deleted`,
        );
      })
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
    // Also exclude private integrations not created by the current user
    return integrations.filter((integration) => {
      if (
        integration.is_private &&
        param.userId &&
        integration.created_by !== param.userId
      ) {
        return false;
      }
      if (integration.is_global) return true;
      if (!integration.is_restricted) return true;
      return linkedIntegrationIds.has(integration.id);
    });
  }

  /**
   * Read a single integration from a base context (with config).
   * Only the creator can see the config; verifies the integration is available to the base.
   */
  async readFromBase(
    context: NcContext,
    param: {
      baseId: string;
      integrationId: string;
      userId?: string;
      includeConfig?: boolean;
    },
  ) {
    const integration = await Integration.get(context, param.integrationId);
    if (!integration) {
      NcError.get(context).integrationNotFound(param.integrationId);
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

    if (param.includeConfig) {
      // Only the creator can see config
      if (integration.is_private && param.userId !== integration.created_by) {
        integration.config = undefined;
      } else {
        integration.config = await integration.getConnectionConfig();
      }
    }

    if (integration.type === IntegrationsTypeEnum.Database) {
      maskKnexConfig(integration);
    }

    return integration;
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

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();

    try {
      // Delegate to integrationsService.integrationCreate which handles:
      // - validatePayload (swagger schema validation)
      // - SQLite duplicate file check
      // - Title trimming
      // - AppEvents.INTEGRATION_CREATE (audit trail)
      const integration = await this.integrationsService.integrationCreate(
        context,
        {
          workspaceId,
          integration: {
            ...param.integration,
            is_restricted: true,
          },
          req: param.req,
        },
        ncMeta,
      );

      // Auto-link to this base
      await IntegrationLink.insert(
        context,
        {
          fk_integration_id: integration.id,
          base_id: param.baseId,
          fk_workspace_id: workspaceId,
          created_by: userId,
        },
        ncMeta,
      );

      await ncMeta.commit();

      return integration;
    } catch (e) {
      await ncMeta.rollback(e);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      NcError.get(context).internalServerError(
        'Failed to create integration from base',
      );
    }
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

    const baseIds = links.map((l) => l.base_id).filter(Boolean) as string[];

    const bases: { id: string; title: string }[] = [];

    if (baseIds.length) {
      const knex = Noco.ncMeta.knex;
      const rows = await knex(MetaTable.PROJECT)
        .select('id', 'title')
        .whereIn('id', baseIds);

      for (const row of rows) {
        bases.push({ id: row.id, title: row.title });
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

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();

    try {
      if (param.allBases) {
        // Delete all links + set unrestricted
        await IntegrationLink.deleteByIntegration(
          context,
          param.integrationId,
          ncMeta,
        );
        await Integration.updateIntegration(
          context,
          param.integrationId,
          { is_restricted: false },
          ncMeta,
        );
        await ncMeta.commit();
        return { all_bases: true };
      }

      if (param.baseIds?.length) {
        // Set restricted + replace links
        await Integration.updateIntegration(
          context,
          param.integrationId,
          { is_restricted: true },
          ncMeta,
        );
        await IntegrationLink.replaceLinksForIntegration(
          context,
          {
            integrationId: param.integrationId,
            baseIds: param.baseIds,
            workspaceId: integration.fk_workspace_id,
            userId: param.userId,
          },
          ncMeta,
        );
        await ncMeta.commit();
        return { all_bases: false, base_ids: param.baseIds };
      }
    } catch (e) {
      await ncMeta.rollback(e);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      NcError.get(context).internalServerError('Failed to update linked bases');
    }

    NcError.get(context).badRequest(
      'Either all_bases or base_ids must be provided.',
    );
  }
}
