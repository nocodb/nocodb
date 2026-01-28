import { Injectable } from '@nestjs/common';
import {
  BaseVersion,
  DeploymentStatus,
  DeploymentType,
  ManagedAppVersionStatus,
  ManagedAppVisibility,
  NO_SCOPE,
  ProjectStatus,
} from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import ManagedApp from '~/models/ManagedApp';
import ManagedAppVersion from '~/models/ManagedAppVersion';
import { Base } from '~/models';
import { BasesService } from '~/services/bases.service';
import { ManagedAppService } from '~/services/managed-app.service';
import ManagedAppDeploymentLog from '~/models/ManagedAppDeploymentLog';
import Noco from '~/Noco';
import { CacheScope, MetaTable } from '~/utils/globals';
import { serializeMeta } from '~/helpers/baseMetaHelpers';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class ManagedAppPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  httpMethod = 'POST' as const;
  operations = [
    'managedAppCreate',
    'managedAppUpdate',
    'managedAppDelete',
    'managedAppPublish',
    'managedAppCreateDraft',
    'managedAppInstall',
  ] as (keyof typeof OPERATION_SCOPES)[];

  constructor(
    private readonly managedAppService: ManagedAppService,
    private readonly basesService: BasesService,
  ) {}

  async handle(
    context: NcContext,
    {
      workspaceId,
      baseId,
      operation,
      payload,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'managedAppCreate':
        return await this.create(context, workspaceId, baseId, payload, req);
      case 'managedAppUpdate':
        return await this.update(context, payload, req);
      case 'managedAppDelete':
        return await this.delete(context, payload, req);
      case 'managedAppPublish':
        return await this.publish(context, payload, req);
      case 'managedAppCreateDraft':
        return await this.createDraft(context, payload, req);
      case 'managedAppInstall':
        return await this.install(context, payload, req);
      default:
        return NcError.notFound('Operation');
    }
  }

  private async create(
    context: NcContext,
    workspaceId: string,
    baseId: string,
    body: any,
    req: NcRequest,
  ) {
    if (!baseId || baseId === NO_SCOPE) {
      const base = await this.basesService.baseCreate({
        base: {
          title: (body.basePayload?.title || body.title)
            .trim()
            .substring(0, 50),
          type: 'database',
          ...{ fk_workspace_id: workspaceId },
          version: BaseVersion.V3,
          ...(body.basePayload?.meta ? { meta: body.basePayload.meta } : {}),
        },
        user: { id: req.user.id },
        req: req,
      });

      context.base_id = base.id;
      baseId = base.id;
      delete body.basePayload;
    } else {
      // Check if base is already an installed managed app instance
      const existingBase = await Base.get(context, baseId);
      if (existingBase?.managed_app_id && !existingBase?.managed_app_master) {
        NcError.get(context).badRequest(
          'Cannot create managed app from an installed managed app instance',
        );
      }

      // Validate base exists and belongs to workspace
      const base = await Base.get(context, baseId);
      if (!base) {
        NcError.get(context).baseNotFound(baseId);
      }

      if (base.fk_workspace_id !== workspaceId) {
        NcError.get(context).badRequest(
          'Base does not belong to this workspace',
        );
      }

      if (base.version !== BaseVersion.V3) {
        NcError.get(context).badRequest(
          'Only V3 bases can be published as managed apps',
        );
      }

      // Check if managed app already exists for this base
      const existingManagedApp = await ManagedApp.getByBaseId(baseId);
      if (existingManagedApp) {
        NcError.get(context).badRequest(
          'A managed app already exists for this base',
        );
      }
    }

    const managedApp = await ManagedApp.insert(context, {
      ...body,
      base_id: baseId,
      fk_workspace_id: workspaceId,
      created_by: req.user.id,
      visibility: body.visibility || ManagedAppVisibility.PRIVATE,
    });

    // Mark the base as a managed app master
    await Base.update(context, baseId, {
      managed_app_master: true,
      managed_app_id: managedApp.id,
    });

    // Create initial v1.0.0 draft version
    const sourceContext: NcContext = {
      workspace_id: workspaceId,
      base_id: baseId,
    };

    // Serialize current schema
    const serializedSchema = await serializeMeta(sourceContext);

    // Create version 1.0.0 as draft
    const initialVersion = await ManagedAppVersion.insert({
      fk_managed_app_id: managedApp.id,
      version: '1.0.0',
      version_number: 1,
      status: ManagedAppVersionStatus.DRAFT,
      fk_workspace_id: workspaceId,
      schema: JSON.stringify(serializedSchema),
    });

    // Set the version on the base
    await Base.update(context, baseId, {
      managed_app_version_id: initialVersion.id,
    });

    return {
      ...managedApp,
      managed_app_id: managedApp.id,
      initial_version: initialVersion,
    };
  }

  private async update(context: NcContext, body: any, req: NcRequest) {
    const { managedAppId, ...updateData } = body;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    const managedApp = await ManagedApp.get(managedAppId);

    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    const base = await Base.get(context, managedApp.base_id);
    if (base?.managed_app_id && !base?.managed_app_master) {
      NcError.get(context).badRequest(
        'ManagedApp management operations are not allowed on installed managed app instances',
      );
    }

    // Only owner can update
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).forbidden(
        'Only the owner can update this managed app',
      );
    }

    // Allow updating: title, description, category, tags, visibility
    const updatedManagedApp = await ManagedApp.update(managedAppId, updateData);

    return updatedManagedApp;
  }

  private async delete(context: NcContext, body: any, req: NcRequest) {
    const { managedAppId } = body;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    const managedApp = await ManagedApp.get(managedAppId);

    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    const base = await Base.get(context, managedApp.base_id);
    if (base?.managed_app_id && !base?.managed_app_master) {
      NcError.get(context).badRequest(
        'ManagedApp management operations are not allowed on installed managed app instances',
      );
    }

    // Only owner can delete
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).forbidden(
        'Only the owner can delete this managed app',
      );
    }

    await ManagedApp.softDelete(managedAppId);
    return {
      message: 'ManagedApp deleted successfully',
    } as any;
  }

  private async createDraft(context: NcContext, body: any, req: NcRequest) {
    const { managedAppId, version } = body;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    if (!version) {
      NcError.get(context).badRequest('version is required');
    }

    const managedApp = await ManagedApp.get(managedAppId);
    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    const base = await Base.get(context, managedApp.base_id);
    if (!base?.managed_app_master) {
      NcError.get(context).badRequest(
        'Only master managed apps can have drafts',
      );
    }

    // Only owner can create drafts
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).forbidden(
        'Only the owner can create drafts for this managed app',
      );
    }

    // Check if version already exists
    const existingVersion = await ManagedAppVersion.getByVersion(
      managedAppId,
      version,
    );
    if (existingVersion) {
      NcError.get(context).badRequest(
        `Version ${version} already exists for this managed app`,
      );
    }

    // Create new draft version
    const newDraft = await ManagedAppVersion.insert({
      fk_managed_app_id: managedAppId,
      version,
      status: ManagedAppVersionStatus.DRAFT,
      fk_workspace_id: context.workspace_id,
      schema: null,
    });

    // Update base to point to new draft
    await Base.update(context, base.id, {
      managed_app_version_id: newDraft.id,
    });

    return {
      message: 'New draft version created successfully',
      version: newDraft,
    } as any;
  }

  private async publish(context: NcContext, body: any, req: NcRequest) {
    const { managedAppVersionId, releaseNotes } = body;

    if (!managedAppVersionId) {
      NcError.get(context).badRequest('managedAppVersionId is required');
    }

    // Get the version to publish
    const version = await ManagedAppVersion.get(managedAppVersionId);
    if (!version) {
      NcError.get(context).notFound('ManagedApp version not found');
    }

    // Get the managed app
    const managedApp = await ManagedApp.get(version.fk_managed_app_id);
    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    // Only owner can publish
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).forbidden(
        'Only the owner can publish this managed app',
      );
    }

    // Check if version is already published
    if (version.status === ManagedAppVersionStatus.PUBLISHED) {
      NcError.get(context).badRequest('Version is already published');
    }

    const base = await Base.get(context, managedApp.base_id);
    if (!base?.managed_app_master) {
      NcError.get(context).badRequest(
        'Only managed app masters can publish versions',
      );
    }

    // Serialize current schema
    const sourceContext: NcContext = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const serializedSchema = await serializeMeta(sourceContext);

    // Update version to published
    await ManagedAppVersion.update(managedAppVersionId, {
      status: ManagedAppVersionStatus.PUBLISHED,
      published_at: new Date().toISOString(),
      schema: JSON.stringify(serializedSchema),
      release_notes: releaseNotes,
    });

    // Clear cache
    await NocoCache.del(
      context,
      `${CacheScope.MANAGED_APP_VERSION}:${managedAppVersionId}`,
    );

    // Update managed app published_at if this is the first publish
    const isInitialPublish = !managedApp.published_at;
    if (isInitialPublish) {
      await ManagedApp.update(managedApp.id, {
        published_at: new Date().toISOString(),
      });
    }

    // Apply updates to installations with auto_update=true
    await this.updateAllInstallations(context, managedApp.id, base, req);

    return {
      message: 'Version published successfully',
      managedAppId: managedApp.id,
      versionId: managedAppVersionId,
      version: version.version,
      isInitialPublish,
    } as any;
  }

  private async install(context: NcContext, body: any, req: NcRequest) {
    const { managedAppId, target_workspace_id } = body;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    if (!target_workspace_id) {
      NcError.get(context).badRequest('target_workspace_id is required');
    }

    const managedApp = await ManagedApp.get(managedAppId);

    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    // Can only install if managed app has published versions
    if (!managedApp.published_at) {
      NcError.get(context).badRequest(
        'Only managed apps with published versions can be installed',
      );
    }

    // Get the latest published version
    const versions = await ManagedAppVersion.list(managedAppId);
    const publishedVersions = versions.filter(
      (v) => v.status === ManagedAppVersionStatus.PUBLISHED,
    );

    if (!publishedVersions || publishedVersions.length === 0) {
      NcError.get(context).notFound(
        'No published versions found for this managed app',
      );
    }

    // Use the latest published version
    const managedAppVersion = publishedVersions[0];

    // 1. Create new base in target workspace using BasesService
    const targetBase = await this.basesService.baseCreate({
      base: {
        title: managedApp.title,
        status: ProjectStatus.JOB,
        ...{ fk_workspace_id: target_workspace_id },
        version: BaseVersion.V3,
        // Mark as managed app installation
        ...{
          managed_app_master: false,
          managed_app_id: managedAppId,
          managed_app_version_id: managedAppVersion.id,
          auto_update: true,
        },
      },
      user: { id: req.user.id },
      req: { user: { id: req.user.id } } as any,
    });

    const targetContext: NcContext = {
      workspace_id: target_workspace_id,
      base_id: targetBase.id,
    };

    // Create deployment log
    const deploymentLog = await ManagedAppDeploymentLog.insert({
      fk_workspace_id: target_workspace_id,
      base_id: targetBase.id,
      fk_managed_app_id: managedAppId,
      from_version_id: null, // Initial install
      to_version_id: managedAppVersion.id,
      status: DeploymentStatus.IN_PROGRESS,
      deployment_type: DeploymentType.INSTALL,
      started_at: new Date().toISOString(),
    });

    try {
      // 2. Use ManagedAppService to install from serialized schema
      await this.managedAppService.installFromManagedApp({
        targetBase,
        targetContext,
        managedAppId,
      });

      // Mark deployment as successful
      await ManagedAppDeploymentLog.update(deploymentLog.id, {
        status: DeploymentStatus.SUCCESS,
        completed_at: new Date().toISOString(),
      });

      // Increment install count
      await ManagedApp.incrementInstallCount(managedAppId);

      return {
        message: 'ManagedApp installed successfully',
        managedAppId,
        version: managedAppVersion.version,
        sourceBaseId: managedApp.base_id,
        targetWorkspaceId: target_workspace_id,
        installedBaseId: targetBase.id,
        installedBase: {
          id: targetBase.id,
          title: targetBase.title,
          managed_app_master: false,
          managed_app_id: managedAppId,
          managed_app_version_id: managedAppVersion.id,
          auto_update: true,
        },
      } as any;
    } catch (error) {
      // Mark deployment as failed
      await ManagedAppDeploymentLog.update(deploymentLog.id, {
        status: DeploymentStatus.FAILED,
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });

      // Cleanup: Delete the target base if installation fails
      await this.basesService.baseSoftDelete(targetContext, {
        baseId: targetBase.id,
        user: req.user,
        req,
      });

      console.error(error);

      throw error;
    }
  }

  /**
   * Isolated method to update all installations of a managed app
   * Can be called manually or automatically during publish
   * In the future, this can be replaced with a pull-based approach
   */
  private async updateAllInstallations(
    context: NcContext,
    managedAppId: string,
    masterBase: Base,
    req: NcRequest,
  ) {
    // Get the new version ID from the master base
    const newVersionId = masterBase.managed_app_version_id;

    // Find all bases that were installed from this managed apps (have managed_app_id and managed_app_master=false)
    const installedBases = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .where('managed_app_id', managedAppId)
      .where((qb) => {
        qb.where('managed_app_master', false).orWhere(
          'managed_app_master',
          null,
        );
      })
      .where((qb) => {
        qb.where('deleted', false).orWhere('deleted', null);
      })
      .where((qb) => {
        qb.where('is_snapshot', false).orWhere('is_snapshot', null);
      })
      .where('auto_update', true);

    if (!installedBases || installedBases.length === 0) {
      return {
        message: 'No installations found',
        managedAppId,
        updatedCount: 0,
      };
    }

    const results = [];
    const errors = [];

    // Iterate over all installed bases and apply updates
    for (const installedBaseData of installedBases) {
      let deploymentLog;
      try {
        console.log(
          `Applying updates to installed base ${installedBaseData.id} from managed app ${managedAppId}`,
        );
        const installedBase = new Base(installedBaseData);

        const installedContext: NcContext = {
          workspace_id: installedBase.fk_workspace_id,
          base_id: installedBase.id,
        };

        const masterContext: NcContext = {
          workspace_id: masterBase.fk_workspace_id,
          base_id: masterBase.id,
        };

        // For master base itself, skip
        if (installedBase.id === masterBase.id) {
          continue;
        }

        // Create deployment log
        deploymentLog = await ManagedAppDeploymentLog.insert({
          fk_workspace_id: installedBase.fk_workspace_id,
          base_id: installedBase.id,
          fk_managed_app_id: managedAppId,
          from_version_id: installedBase.managed_app_version_id,
          to_version_id: newVersionId,
          status: DeploymentStatus.IN_PROGRESS,
          deployment_type: DeploymentType.UPDATE,
          started_at: new Date().toISOString(),
        });

        // Use the ManagedAppService to apply metadata diff and update version
        const updateResult =
          await this.managedAppService.applyUpdatesToInstallation({
            masterBase,
            installedBase,
            req,
            masterContext,
            installedContext,
            newVersionId, // Pass the new version ID to update
          });

        // Mark deployment as successful
        await ManagedAppDeploymentLog.update(deploymentLog.id, {
          status: DeploymentStatus.SUCCESS,
          completed_at: new Date().toISOString(),
          deployment_log: `Successfully updated from version ${updateResult.fromVersionId} to ${updateResult.toVersionId}`,
        });

        console.log(
          `Successfully applied updates to installed base ${installedBaseData.id}`,
        );

        results.push({
          baseId: installedBase.id,
          title: installedBase.title,
          status: 'success',
          fromVersion: updateResult.fromVersionId,
          toVersion: updateResult.toVersionId,
        });
      } catch (error) {
        console.error(
          `Failed to apply updates to installed base ${installedBaseData.id}:`,
          error,
        );

        // Mark deployment as failed if we created a log
        if (deploymentLog) {
          await ManagedAppDeploymentLog.update(deploymentLog.id, {
            status: DeploymentStatus.FAILED,
            error_message: error.message,
            completed_at: new Date().toISOString(),
          });
        }

        errors.push({
          baseId: installedBaseData.id,
          title: installedBaseData.title,
          error: error.message,
        });
      }
    }

    return {
      message: 'Updates applied to all installations',
      managedAppId,
      totalInstallations: installedBases.length,
      successfulUpdates: results.length,
      failedUpdates: errors.length,
      results,
      errors,
    };
  }
}
