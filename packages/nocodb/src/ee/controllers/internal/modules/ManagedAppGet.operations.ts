import { Injectable } from '@nestjs/common';
import { DeploymentStatus, type NcContext, type NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import ManagedApp from '~/models/ManagedApp';
import ManagedAppVersion from '~/models/ManagedAppVersion';
import ManagedAppDeploymentLog from '~/models/ManagedAppDeploymentLog';
import { Base } from '~/models';
import { diffMeta, serializeMeta } from '~/helpers/baseMetaHelpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class ManagedAppGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  httpMethod = 'GET' as const;
  operations = [
    'managedAppStoreList',
    'managedAppList',
    'managedAppGet',
    'managedAppGetUpdates',
    'managedAppVersionsList',
    'managedAppDeployments',
    'managedAppVersionDeployments',
    'managedAppDeploymentLogs',
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
      case 'managedAppStoreList':
        return await this.listStore(context, req);
      case 'managedAppList':
        return await this.list(context, workspaceId, req);
      case 'managedAppGet':
        return await this.get(context, req);
      case 'managedAppGetUpdates':
        return await this.getUpdates(context, req);
      case 'managedAppVersionsList':
        return await this.listVersions(context, req);
      case 'managedAppDeployments':
        return await this.getDeployments(context, req);
      case 'managedAppVersionDeployments':
        return await this.getVersionDeployments(context, req);
      case 'managedAppDeploymentLogs':
        return await this.getDeploymentLogs(context, req);
      default:
        return NcError.notFound('Operation');
    }
  }

  private async listStore(context: NcContext, req: NcRequest) {
    const { category, search, limit, offset } = req.query;

    const managedApps = await ManagedApp.listPublished({
      category: category as string,
      search: search as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
      userId: req.user?.id,
      workspaceId: context.workspace_id,
    });

    return {
      list: managedApps,
      pageInfo: {},
    };
  }

  private async list(context: NcContext, workspaceId: string, req: NcRequest) {
    const { limit, offset } = req.query;

    const managedApps = await ManagedApp.list({
      workspaceId,
      userId: req.user.id,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return {
      list: managedApps,
      pageInfo: {},
    };
  }

  private async get(context: NcContext, req: NcRequest) {
    const { managedAppId, baseId } = req.query;

    let managedApp: ManagedApp | null = null;

    if (managedAppId) {
      managedApp = await ManagedApp.get(managedAppId as string);
    } else if (baseId) {
      managedApp = await ManagedApp.getByBaseId(baseId as string);
    }

    if (!managedApp) {
      NcError.get(context).notFound('Managed app not found');
    }

    // Check visibility permissions
    const canView = this.canViewManagedApp(
      managedApp,
      req.user?.id,
      context.workspace_id,
    );
    if (!canView) {
      NcError.get(context).notFound('Managed app not found');
    }

    return managedApp;
  }

  private async getUpdates(context: NcContext, req: NcRequest) {
    const { managedAppId, installedBaseId } = req.query;

    const managedApp = await ManagedApp.get(managedAppId as string);

    if (!managedApp) {
      NcError.get(context).notFound('Managed app not found');
    }

    // Check visibility permissions
    const canView = this.canViewManagedApp(
      managedApp,
      req.user?.id,
      context.workspace_id,
    );
    if (!canView) {
      NcError.get(context).notFound('Managed app not found');
    }

    const masterBase = await Base.get(context, managedApp.base_id);
    if (!masterBase) {
      NcError.get(context).baseNotFound(managedApp.base_id);
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
      managedApp,
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
    const { managedAppId } = req.query;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    const managedApp = await ManagedApp.get(managedAppId as string);

    if (!managedApp) {
      NcError.get(context).notFound('Managed app not found');
    }

    // Only owner can view version history
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view version history',
      );
    }

    const versions = await ManagedAppVersion.list(managedAppId as string);

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
    const { managedAppId } = req.query;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    const managedApp = await ManagedApp.get(managedAppId as string);

    if (!managedApp) {
      NcError.get(context).notFound('Managed app not found');
    }

    // Only owner can view deployment statistics
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view deployment statistics',
      );
    }

    // Get all bases that have this managed app installed with latest deployment log status
    const installedBases = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .leftJoin(
        Noco.ncMeta.knexConnection.raw(
          `(
            SELECT DISTINCT ON (base_id) base_id, status
            FROM ${MetaTable.MANAGED_APP_DEPLOYMENT_LOGS}
            ORDER BY base_id, created_at DESC
          ) as latest_log`,
        ),
        `${MetaTable.PROJECT}.id`,
        'latest_log.base_id',
      )
      .where(`${MetaTable.PROJECT}.managed_app_id`, managedAppId)
      .where(`${MetaTable.PROJECT}.managed_app_master`, false)
      .where(`${MetaTable.PROJECT}.deleted`, false)
      .select(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.managed_app_version_id`,
        `${MetaTable.PROJECT}.updated_at`,
        `${MetaTable.PROJECT}.created_at`,
        'latest_log.status as deployment_status',
      );

    // Get version information for each installation
    const versions = await ManagedAppVersion.list(managedAppId);
    const versionMap = new Map(
      versions.map((v) => [v.id, { version: v.version, status: v.status }]),
    );

    // Build deployment list with version info and deployment status
    const deploymentsList = installedBases.map((base) => {
      const versionInfo = versionMap.get(base.managed_app_version_id);
      return {
        baseId: base.id,
        baseTitle: base.title,
        version: versionInfo?.version || 'unknown',
        versionId: base.managed_app_version_id,
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
      managedApp: {
        id: managedApp.id,
        title: managedApp.title,
        installCount: managedApp.install_count || 0,
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
   * Only accessible by managed app owner
   */
  private async getVersionDeployments(context: NcContext, req: NcRequest) {
    const { managedAppId, versionId, limit, offset } = req.query;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    if (!versionId) {
      NcError.get(context).badRequest('versionId is required');
    }

    const managedApp = await ManagedApp.get(managedAppId as string);

    if (!managedApp) {
      NcError.get(context).notFound('Managed app not found');
    }

    // Only owner can view version deployments
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view version deployments',
      );
    }

    // Get version info
    const version = await ManagedAppVersion.get(versionId as string);
    if (!version || version.fk_managed_app_id !== managedAppId) {
      NcError.get(context).notFound('Version not found');
    }

    const pageLimit = limit ? parseInt(limit as string, 10) : 10;
    const pageOffset = offset ? parseInt(offset as string, 10) : 0;

    // Get total count
    const [{ count: totalCount }] = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .where('managed_app_id', managedAppId)
      .where('managed_app_version_id', versionId)
      .where((qb) => {
        qb.where('managed_app_master', false).orWhere('managed_app_master', null);
      })
      .where((qb) => {
        qb.where('deleted', false).orWhere('deleted', null);
      })
      .where((qb) => {
        qb.where('is_snapshot', false).orWhere('is_snapshot', null);
      })
      .count('* as count');

    // Get paginated results with latest deployment log status
    const deployments = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .leftJoin(
        Noco.ncMeta.knexConnection.raw(
          `(
            SELECT DISTINCT ON (base_id) base_id, status
            FROM ${MetaTable.MANAGED_APP_DEPLOYMENT_LOGS}
            ORDER BY base_id, created_at DESC
          ) as latest_log`,
        ),
        `${MetaTable.PROJECT}.id`,
        'latest_log.base_id',
      )
      .where(`${MetaTable.PROJECT}.managed_app_id`, managedAppId)
      .where(`${MetaTable.PROJECT}.managed_app_version_id`, versionId)
      .where(`${MetaTable.PROJECT}.managed_app_master`, false)
      .where(`${MetaTable.PROJECT}.deleted`, false)
      .select(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.fk_workspace_id`,
        `${MetaTable.PROJECT}.managed_app_version_id`,
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
      versionId: base.managed_app_version_id,
      installedAt: base.created_at,
      lastUpdated: base.updated_at,
      status: base.deployment_status || 'unknown',
    }));

    return {
      managedApp: {
        id: managedApp.id,
        title: managedApp.title,
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

    // Verify this is a managed app installation
    if (!base.managed_app_id || base.managed_app_master) {
      NcError.get(context).badRequest(
        'This base is not a managed app installation',
      );
    }

    // Get the managed app and verify ownership
    const managedApp = await ManagedApp.get(base.managed_app_id);
    if (!managedApp) {
      NcError.get(context).notFound('Managed app not found');
    }

    // Only owner can view deployment logs
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can view deployment logs',
      );
    }

    const pageLimit = limit ? parseInt(limit as string, 10) : 10;
    const pageOffset = offset ? parseInt(offset as string, 10) : 0;

    // Get deployment logs for this installation with pagination
    const allLogs = await ManagedAppDeploymentLog.list(baseId as string);
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
      versionIds.map((vId) => ManagedAppVersion.get(vId)),
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
        managedAppId: base.managed_app_id,
        currentVersionId: base.managed_app_version_id,
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
   * Check if user can view a managed app based on visibility rules:
   * - Public: visible to everyone
   * - Private: visible to users in the same workspace
   * - Unlisted: visible only to the owner
   */
  private canViewManagedApp(
    managedApp: ManagedApp,
    userId?: string,
    workspaceId?: string,
  ): boolean {
    if (managedApp.visibility === 'public') {
      return true;
    }

    if (managedApp.visibility === 'private') {
      return managedApp.fk_workspace_id === workspaceId;
    }

    if (managedApp.visibility === 'unlisted') {
      return managedApp.created_by === userId;
    }

    // Default deny
    return false;
  }
}
