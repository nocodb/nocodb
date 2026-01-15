import { Injectable } from '@nestjs/common';
import { DeploymentStatus, type NcContext, type NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import Sandbox from '~/models/Sandbox';
import SandboxVersion from '~/models/SandboxVersion';
import SandboxDeploymentLog from '~/models/SandboxDeploymentLog';
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
    'sandboxDeployments',
    'sandboxVersionDeployments',
    'sandboxDeploymentLogs',
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
      case 'sandboxDeployments':
        return await this.getDeployments(context, req);
      case 'sandboxVersionDeployments':
        return await this.getVersionDeployments(context, req);
      case 'sandboxDeploymentLogs':
        return await this.getDeploymentLogs(context, req);
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
      userId: req.user?.id,
      workspaceId: context.workspace_id,
    });

    return {
      list: sandboxes,
      pageInfo: {},
    };
  }

  private async list(context: NcContext, workspaceId: string, req: NcRequest) {
    const { limit, offset } = req.query;

    const sandboxes = await Sandbox.list(context, {
      workspaceId,
      userId: req.user.id,
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

    // Check visibility permissions
    const canView = this.canViewSandbox(
      sandbox,
      req.user?.id,
      context.workspace_id,
    );
    if (!canView) {
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

    // Check visibility permissions
    const canView = this.canViewSandbox(
      sandbox,
      req.user?.id,
      context.workspace_id,
    );
    if (!canView) {
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
        status: v.status,
        release_notes: v.release_notes,
        created_at: v.created_at,
        published_at: v.published_at,
      })),
      pageInfo: {},
    } as any;
  }

  private async getDeployments(context: NcContext, req: NcRequest) {
    const { sandboxId } = req.query;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId as string);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Only owner can view deployment statistics
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view deployment statistics',
      );
    }

    // Get all bases that have this sandbox installed with latest deployment log status
    const installedBases = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .leftJoin(
        Noco.ncMeta.knexConnection.raw(
          `(
            SELECT DISTINCT ON (base_id) base_id, status
            FROM ${MetaTable.SANDBOX_DEPLOYMENT_LOGS}
            ORDER BY base_id, created_at DESC
          ) as latest_log`,
        ),
        `${MetaTable.PROJECT}.id`,
        'latest_log.base_id',
      )
      .where(`${MetaTable.PROJECT}.sandbox_id`, sandboxId)
      .where(`${MetaTable.PROJECT}.sandbox_master`, false)
      .where(`${MetaTable.PROJECT}.deleted`, false)
      .select(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.sandbox_version_id`,
        `${MetaTable.PROJECT}.updated_at`,
        `${MetaTable.PROJECT}.created_at`,
        'latest_log.status as deployment_status',
      );

    // Get version information for each installation
    const versions = await SandboxVersion.list(context, sandboxId);
    const versionMap = new Map(
      versions.map((v) => [v.id, { version: v.version, status: v.status }]),
    );

    // Build deployment list with version info and deployment status
    const deploymentsList = installedBases.map((base) => {
      const versionInfo = versionMap.get(base.sandbox_version_id);
      return {
        baseId: base.id,
        baseTitle: base.title,
        version: versionInfo?.version || 'unknown',
        versionId: base.sandbox_version_id,
        installedAt: base.created_at,
        lastUpdated: base.updated_at,
        status: base.deployment_status || 'unknown',
      };
    });

    // Calculate statistics by version
    const versionStats = versions.map((version) => {
      const deploymentsForVersion = deploymentsList.filter(
        (d) => d.versionId === version.id,
      );
      return {
        versionId: version.id,
        version: version.version,
        versionNumber: version.version_number,
        status: version.status,
        deploymentCount: deploymentsForVersion.length,
        publishedAt: version.published_at,
      };
    });

    // Calculate overall statistics
    const totalDeployments = deploymentsList.length;
    const activeDeployments = deploymentsList.filter(
      (d) => d.status !== DeploymentStatus.FAILED,
    ).length;
    const failedDeployments = deploymentsList.filter(
      (d) => d.status === DeploymentStatus.FAILED,
    ).length;

    return {
      sandbox: {
        id: sandbox.id,
        title: sandbox.title,
        installCount: sandbox.install_count || 0,
      },
      statistics: {
        totalDeployments,
        activeDeployments,
        failedDeployments: failedDeployments,
        totalVersions: versions.length,
      },
      versionStats,
      deployments: deploymentsList,
      pageInfo: {},
    } as any;
  }

  /**
   * Get deployments for a specific version (paginated)
   * Only accessible by sandbox owner
   */
  private async getVersionDeployments(context: NcContext, req: NcRequest) {
    const { sandboxId, versionId, limit, offset } = req.query;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    if (!versionId) {
      NcError.get(context).badRequest('versionId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId as string);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Only owner can view version deployments
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view version deployments',
      );
    }

    // Get version info
    const version = await SandboxVersion.get(context, versionId as string);
    if (!version || version.fk_sandbox_id !== sandboxId) {
      NcError.get(context).notFound('Version not found');
    }

    const pageLimit = limit ? parseInt(limit as string, 10) : 10;
    const pageOffset = offset ? parseInt(offset as string, 10) : 0;

    // Get total count
    const [{ count: totalCount }] = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .where('sandbox_id', sandboxId)
      .where('sandbox_version_id', versionId)
      .where('sandbox_master', (qb) => {
        qb.where(false).orWhereNull();
      })
      .where('deleted', (qb) => {
        qb.where(false).orWhereNull();
      })
      .where('is_snapshot', (qb) => {
        qb.where(false).orWhereNull();
      })
      .count('* as count');

    // Get paginated results with latest deployment log status
    const deployments = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .leftJoin(
        Noco.ncMeta.knexConnection.raw(
          `(
            SELECT DISTINCT ON (base_id) base_id, status
            FROM ${MetaTable.SANDBOX_DEPLOYMENT_LOGS}
            ORDER BY base_id, created_at DESC
          ) as latest_log`,
        ),
        `${MetaTable.PROJECT}.id`,
        'latest_log.base_id',
      )
      .where(`${MetaTable.PROJECT}.sandbox_id`, sandboxId)
      .where(`${MetaTable.PROJECT}.sandbox_version_id`, versionId)
      .where(`${MetaTable.PROJECT}.sandbox_master`, false)
      .where(`${MetaTable.PROJECT}.deleted`, false)
      .select(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.fk_workspace_id`,
        `${MetaTable.PROJECT}.sandbox_version_id`,
        `${MetaTable.PROJECT}.updated_at`,
        `${MetaTable.PROJECT}.created_at`,
        'latest_log.status as deployment_status',
      )
      .orderBy(`${MetaTable.PROJECT}.updated_at`, 'desc')
      .limit(pageLimit)
      .offset(pageOffset);

    // Enrich with workspace info if needed
    const enrichedDeployments = deployments.map((base) => ({
      baseId: base.id,
      baseTitle: base.title,
      workspaceId: base.fk_workspace_id,
      versionId: base.sandbox_version_id,
      installedAt: base.created_at,
      lastUpdated: base.updated_at,
      status: base.deployment_status || 'unknown',
    }));

    return {
      sandbox: {
        id: sandbox.id,
        title: sandbox.title,
      },
      version: {
        id: version.id,
        version: version.version,
        versionNumber: version.version_number,
      },
      list: enrichedDeployments,
      pageInfo: {
        totalRows: Number(totalCount),
        page: Math.floor(pageOffset / pageLimit) + 1,
        pageSize: pageLimit,
        isFirstPage: pageOffset === 0,
        isLastPage: pageOffset + pageLimit >= Number(totalCount),
      },
    } as any;
  }

  /**
   * Get deployment logs for a specific base installation
   * Shows version history and deployment status
   */
  private async getDeploymentLogs(context: NcContext, req: NcRequest) {
    const { baseId, limit, offset } = req.query;

    if (!baseId) {
      NcError.get(context).badRequest('baseId is required');
    }

    // Get the base
    const base = await Base.get(context, baseId as string);

    if (!base) {
      NcError.get(context).notFound('Base not found');
    }

    // Verify this is a sandbox installation
    if (!base.sandbox_id || base.sandbox_master) {
      NcError.get(context).badRequest(
        'This base is not a sandbox installation',
      );
    }

    // Get the sandbox and verify ownership
    const sandbox = await Sandbox.get(context, base.sandbox_id);
    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Only owner can view deployment logs
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view deployment logs',
      );
    }

    const pageLimit = limit ? parseInt(limit as string, 10) : 10;
    const pageOffset = offset ? parseInt(offset as string, 10) : 0;

    // Get deployment logs for this installation with pagination
    const allLogs = await SandboxDeploymentLog.list(baseId as string);
    const totalCount = allLogs.length;
    const logs = allLogs.slice(pageOffset, pageOffset + pageLimit);

    // Get version information to enrich the logs
    const versionIds = [
      ...new Set([
        ...logs.map((log) => log.from_version_id).filter(Boolean),
        ...logs.map((log) => log.to_version_id),
      ]),
    ];

    const versions = await Promise.all(
      versionIds.map((vId) => SandboxVersion.get(context, vId)),
    );

    const versionMap = new Map(versions.filter(Boolean).map((v) => [v.id, v]));

    // Enrich logs with version information
    const enrichedLogs = logs.map((log) => {
      const fromVersion = log.from_version_id
        ? versionMap.get(log.from_version_id)
        : null;
      const toVersion = versionMap.get(log.to_version_id);

      return {
        id: log.id,
        deploymentType: log.deployment_type,
        status: log.status,
        fromVersion: fromVersion
          ? {
              id: fromVersion.id,
              version: fromVersion.version,
            }
          : null,
        toVersion: toVersion
          ? {
              id: toVersion.id,
              version: toVersion.version,
            }
          : null,
        errorMessage: log.error_message,
        deploymentLog: log.deployment_log,
        createdAt: log.created_at,
        startedAt: log.started_at,
        completedAt: log.completed_at,
      };
    });

    return {
      base: {
        id: base.id,
        title: base.title,
        sandboxId: base.sandbox_id,
        currentVersionId: base.sandbox_version_id,
      },
      logs: enrichedLogs,
      pageInfo: {
        totalRows: totalCount,
        page: Math.floor(pageOffset / pageLimit) + 1,
        pageSize: pageLimit,
        isFirstPage: pageOffset === 0,
        isLastPage: pageOffset + pageLimit >= totalCount,
      },
    } as any;
  }

  /**
   * Check if user can view a sandbox based on visibility rules:
   * - Public: visible to everyone
   * - Private: visible to users in the same workspace
   * - Unlisted: visible only to the owner
   */
  private canViewSandbox(
    sandbox: Sandbox,
    userId?: string,
    workspaceId?: string,
  ): boolean {
    if (sandbox.visibility === 'public') {
      return true;
    }

    if (sandbox.visibility === 'private') {
      return sandbox.fk_workspace_id === workspaceId;
    }

    if (sandbox.visibility === 'unlisted') {
      return sandbox.created_by === userId;
    }

    // Default deny
    return false;
  }
}
