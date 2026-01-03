import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import type { SandboxStatus } from '~/ee/models/Sandbox';
import { NcError } from '~/helpers/catchError';
import Sandbox from '~/ee/models/Sandbox';
import SandboxVersion from '~/ee/models/SandboxVersion';
import { Base } from '~/models';
import { diffMeta, serializeMeta } from '~/helpers/baseMetaHelpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class SandboxGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  httpMethod = 'GET' as const;
  operations = [
    'sandboxStoreList',
    'sandboxList',
    'sandboxGet',
    'sandboxGetUpdates',
    'sandboxVersionsList',
  ] as (keyof typeof OPERATION_SCOPES)[];

  async handle(
    context: NcContext,
    {
      workspaceId,
      operation,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'sandboxStoreList':
        return await this.listStore(context, req);
      case 'sandboxList':
        return await this.list(context, workspaceId, req);
      case 'sandboxGet':
        return await this.get(context, req);
      case 'sandboxGetUpdates':
        return await this.getUpdates(context, req);
      case 'sandboxVersionsList':
        return await this.listVersions(context, req);
      default:
        return NcError.notFound('Operation');
    }
  }

  private async listStore(context: NcContext, req: NcRequest) {
    const { category, search, limit, offset } = req.query;

    const sandboxes = await Sandbox.listPublished(context, {
      category: category as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return {
      list: sandboxes,
      pageInfo: {},
    };
  }

  private async list(context: NcContext, workspaceId: string, req: NcRequest) {
    const { status, limit, offset } = req.query;

    const sandboxes = await Sandbox.list(context, {
      workspaceId,
      userId: req.user.id,
      status: status as SandboxStatus,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return {
      list: sandboxes,
      pageInfo: {},
    };
  }

  private async get(context: NcContext, req: NcRequest) {
    const { sandboxId, baseId } = req.query;

    let sandbox: Sandbox | null = null;

    if (sandboxId) {
      sandbox = await Sandbox.get(context, sandboxId as string);
    } else if (baseId) {
      sandbox = await Sandbox.getByBaseId(context, baseId as string);
    }

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    return sandbox;
  }

  private async getUpdates(context: NcContext, req: NcRequest) {
    const { sandboxId, installedBaseId } = req.query;

    const sandbox = await Sandbox.get(context, sandboxId as string);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    const masterBase = await Base.get(context, sandbox.base_id);
    if (!masterBase) {
      NcError.get(context).baseNotFound(sandbox.base_id);
    }

    const installedBase = await Base.get(context, installedBaseId as string);
    if (!installedBase) {
      NcError.get(context).baseNotFound(installedBaseId as string);
    }

    // Get installed base's primary source for proper source_id override
    const installedSources = await installedBase.getSources();
    const installedSourceId = installedSources?.[0]?.id;

    if (!installedSourceId) {
      throw new Error(`No sources found in installed base ${installedBase.id}`);
    }

    const masterContext: NcContext = {
      workspace_id: masterBase.fk_workspace_id,
      base_id: masterBase.id,
    };

    const installedContext: NcContext = {
      workspace_id: installedBase.fk_workspace_id,
      base_id: installedBase.id,
    };

    // Serialize metadata from both bases
    const masterMeta = await serializeMeta(masterContext, {
      override: {
        fk_workspace_id: installedContext.workspace_id,
        base_id: installedContext.base_id,
        source_id: installedSourceId,
      },
      ...(masterBase.prefix
        ? {
            prefix: {
              old: masterBase.prefix,
              new: installedBase.prefix || '',
            },
          }
        : {}),
    });

    const installedMeta = await serializeMeta(installedContext);

    // Calculate diff
    const diff = await diffMeta(installedMeta, masterMeta);

    return {
      sandbox,
      masterBase: {
        id: masterBase.id,
        title: masterBase.title,
        version: masterBase.version,
      },
      installedBase: {
        id: installedBase.id,
        title: installedBase.title,
        version: installedBase.version,
      },
      diff,
      hasUpdates: diff && Object.keys(diff).length > 0,
    } as any;
  }

  private async listVersions(context: NcContext, req: NcRequest) {
    const { sandboxId } = req.query;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId as string);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Only owner can view version history
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view version history',
      );
    }

    const versions = await SandboxVersion.list(context, sandboxId as string);

    return {
      list: versions.map((v) => ({
        id: v.id,
        version: v.version,
        version_number: v.version_number,
        release_notes: v.release_notes,
        created_at: v.created_at,
      })),
      pageInfo: {},
    } as any;
  }
}
