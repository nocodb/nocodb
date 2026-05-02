import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
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
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { NcError } from '~/helpers/catchError';
import ManagedApp from '~/models/ManagedApp';
import ManagedAppVersion from '~/models/ManagedAppVersion';
import { Base } from '~/models';
import { BasesService } from '~/services/bases.service';
import { ManagedAppService } from '~/services/managed-app.service';
import { BaseVariablesService } from '~/ee/services/base-variables.service';
import ManagedAppDeploymentLog from '~/models/ManagedAppDeploymentLog';
import { CacheScope, MetaTable } from '~/utils/globals';
import { serializeMeta } from '~/helpers/baseMetaHelpers';
import NocoCache from '~/cache/NocoCache';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class ManagedAppPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  httpMethod = 'POST' as const;
  private readonly logger = new Logger(ManagedAppPostOperations.name);

  operations = [
    'managedAppCreate',
    'managedAppUpdate',
    'managedAppDelete',
    'managedAppPublish',
    'managedAppCreateDraft',
    'managedAppDiscardDraft',
    'managedAppInstall',
    'managedAppManualUpdate',
  ] as (keyof typeof OPERATION_SCOPES)[];

  constructor(
    private readonly managedAppService: ManagedAppService,
    private readonly basesService: BasesService,
    private readonly baseVariablesService: BaseVariablesService,
    private readonly appHooksService: AppHooksService,
    @Inject('JobsService') private readonly jobsService: IJobsService,
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
      case 'managedAppDiscardDraft':
        return await this.discardDraft(context, payload, req);
      case 'managedAppInstall':
        return await this.install(context, payload, req);
      case 'managedAppManualUpdate':
        return await this.manualUpdate(context, payload, req);
      default:
        return NcError.notFound('Operation');
    }
  }

  /**
   * Validates version string: supports semver (1.2.3) and calver (2026.1.0).
   * Format: N.N.N where N is a non-negative integer.
   */
  private validateVersion(context: NcContext, version: string) {
    const parts = version.split('.');
    if (parts.length !== 3) {
      NcError.get(context).badRequest(
        'Version must have exactly three numeric parts (e.g. 1.2.3 or 2026.1.0)',
      );
    }
    for (const part of parts) {
      if (!/^\d+$/.test(part)) {
        NcError.get(context).badRequest(
          'Each version part must be a non-negative integer (e.g. 1.2.3 or 2026.1.0)',
        );
      }
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
      const base = await Base.get(context, baseId);
      if (!base) {
        NcError.get(context).baseNotFound(baseId);
      }

      if (base.is_sandbox) {
        NcError.get(context).badRequest(
          'Cannot create a managed app from a sandbox base. Publish the production base instead.',
        );
      }

      if (base.managed_app_id && !base.managed_app_master) {
        NcError.get(context).badRequest(
          'Cannot create managed app from an installed managed app instance',
        );
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
      status: ManagedAppVersionStatus.DRAFT,
      fk_workspace_id: workspaceId,
      schema: JSON.stringify(serializedSchema),
    });

    // Set the version on the base
    await Base.update(context, baseId, {
      managed_app_version_id: initialVersion.id,
    });

    this.appHooksService.emit(AppEvents.MANAGED_APP_CREATE, {
      context,
      req,
      managedApp: {
        id: managedApp.id,
        title: managedApp.title,
        base_id: baseId,
      },
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

    this.appHooksService.emit(AppEvents.MANAGED_APP_UPDATE, {
      context,
      req,
      managedApp: {
        id: managedAppId,
        title: updatedManagedApp?.title,
        base_id: managedApp.base_id,
      },
    });

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

    this.appHooksService.emit(AppEvents.MANAGED_APP_DELETE, {
      context,
      req,
      managedApp: {
        id: managedAppId,
        title: managedApp.title,
        base_id: managedApp.base_id,
      },
    });

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

    this.validateVersion(context, version);

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

  private async discardDraft(context: NcContext, body: any, req: NcRequest) {
    const { managedAppId } = body;

    if (!managedAppId) {
      NcError.get(context).badRequest('managedAppId is required');
    }

    const managedApp = await ManagedApp.get(managedAppId);
    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    // Only owner can discard drafts
    if (managedApp.created_by !== req.user.id) {
      NcError.get(context).forbidden(
        'Only the owner can discard drafts for this managed app',
      );
    }

    const base = await Base.get(context, managedApp.base_id);
    if (!base?.managed_app_master) {
      NcError.get(context).badRequest(
        'Only master managed apps can discard drafts',
      );
    }

    // Get the current version (should be a draft)
    const currentVersion = await ManagedAppVersion.get(
      base.managed_app_version_id,
    );
    if (!currentVersion) {
      NcError.get(context).notFound('Current version not found');
    }

    if (currentVersion.status !== ManagedAppVersionStatus.DRAFT) {
      NcError.get(context).badRequest(
        'Current version is not a draft. Nothing to discard.',
      );
    }

    // Get all versions and find the latest published one
    const versions = await ManagedAppVersion.list(managedAppId);
    const publishedVersions = versions.filter(
      (v) => v.status === ManagedAppVersionStatus.PUBLISHED,
    );

    if (!publishedVersions || publishedVersions.length === 0) {
      NcError.get(context).badRequest(
        'No published version found to rollback to. Cannot discard the only version.',
      );
    }

    // Latest published version (versions are ordered by version_number DESC)
    const latestPublishedVersion = publishedVersions[0];

    // Get the published version's schema
    const publishedSchema = latestPublishedVersion.getParsedSchema();
    if (!publishedSchema) {
      NcError.get(context).badRequest(
        'Published version has no stored schema. Cannot rollback.',
      );
    }

    const masterContext: NcContext = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    // Rollback the master base schema to the published version
    await this.managedAppService.rollbackToPublishedVersion({
      masterBase: base,
      masterContext,
      publishedSchema,
      publishedVersionId: latestPublishedVersion.id,
    });

    // Delete the draft version
    await ManagedAppVersion.delete(currentVersion.id);

    // Clear version cache
    await NocoCache.del(
      context,
      `${CacheScope.MANAGED_APP_VERSION}:${currentVersion.id}`,
    );

    return {
      message: 'Draft discarded successfully',
      managedAppId,
      discardedVersionId: currentVersion.id,
      discardedVersion: currentVersion.version,
      rolledBackToVersionId: latestPublishedVersion.id,
      rolledBackToVersion: latestPublishedVersion.version,
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

    // Strip sensitive and required variable values before publishing.
    // default_value is also nulled — it can carry the master's plaintext
    // (decrypted on read) and we never want it leaked through the published
    // schema or surfaced to installers.
    if (serializedSchema[MetaTable.BASE_VARIABLES]?.length) {
      serializedSchema[MetaTable.BASE_VARIABLES] = serializedSchema[
        MetaTable.BASE_VARIABLES
      ].map((v: any) => {
        if (v.inheritance === 'required' || v.type === 'secret') {
          return { ...v, value: null, default_value: null };
        }
        return v;
      });
    }

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

    this.appHooksService.emit(AppEvents.MANAGED_APP_PUBLISH, {
      context,
      req,
      managedApp: {
        id: managedApp.id,
        title: managedApp.title,
        base_id: managedApp.base_id,
      },
      version: { id: managedAppVersionId, version: version.version },
    });

    // Queue background job to update all installations with auto_update=true
    const job = await this.jobsService.add(JobTypes.ManagedAppUpdate, {
      context: {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      },
      user: req.user,
      managedAppId: managedApp.id,
      managedAppTitle: managedApp.title,
      masterBaseId: base.id,
      masterWorkspaceId: base.fk_workspace_id,
      newVersionId: managedAppVersionId,
      newVersion: version.version,
      req,
    });

    return {
      message: 'Version published successfully',
      managedAppId: managedApp.id,
      versionId: managedAppVersionId,
      version: version.version,
      isInitialPublish,
      updateJobId: job.id,
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

    // Rate limit: max 10 installations per workspace per hour
    const recentInstalls = await ManagedAppDeploymentLog.countRecentInstalls(
      target_workspace_id,
    );
    if (recentInstalls >= 10) {
      NcError.get(context).badRequest(
        'Too many installations. Please try again later.',
      );
    }

    // Can only install if managed app has published versions
    if (!managedApp.published_at) {
      NcError.get(context).badRequest(
        'Only managed apps with published versions can be installed',
      );
    }

    // Get the latest published version
    const managedAppVersion = await ManagedAppVersion.getLatest(
      managedAppId,
      ManagedAppVersionStatus.PUBLISHED,
    );
    if (!managedAppVersion) {
      NcError.get(context).notFound(
        'No published versions found for this managed app',
      );
    }

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

      // These are independent — run in parallel
      await Promise.all([
        ManagedAppDeploymentLog.update(deploymentLog.id, {
          status: DeploymentStatus.SUCCESS,
          completed_at: new Date().toISOString(),
        }),
        ManagedApp.incrementInstallCount(managedAppId),
        this.basesService.baseUpdate(targetContext, {
          baseId: targetBase.id,
          base: { status: null },
          user: req.user,
          req,
        }),
      ]);

      this.appHooksService.emit(AppEvents.MANAGED_APP_INSTALL, {
        context: targetContext,
        req,
        managedApp: { id: managedAppId, title: managedApp.title },
        installedBaseId: targetBase.id,
        version: {
          id: managedAppVersion.id,
          version: managedAppVersion.version,
        },
      });

      // Check for variables that need configuration. Route through the
      // service so default_value is stripped and SECRET values are masked
      // before any of this lands in the API response.
      const variables = await this.baseVariablesService.list(
        targetContext,
        targetBase.id,
      );
      const setupVariables = variables.filter(
        (v) =>
          (v.inheritance === 'required' && !v.value) ||
          (v.type === 'secret' && !v.value),
      );

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
        setupRequired: setupVariables.length > 0,
        setupVariables: setupVariables.length > 0 ? setupVariables : undefined,
      } as any;
    } catch (error) {
      // Mark deployment as failed
      await ManagedAppDeploymentLog.update(deploymentLog.id, {
        status: DeploymentStatus.FAILED,
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });

      // Delete the failed install base — it was never used
      await this.basesService.baseSoftDelete(targetContext, {
        baseId: targetBase.id,
        user: req.user,
        req,
      });

      this.logger.error(
        `Failed to install managed app ${managedAppId}: ${error.message}`,
        error.stack,
      );

      throw error;
    }
  }

  /**
   * Manual update: triggered by installer when auto_update failed or is off.
   * Applies the latest published version to the caller's installed base.
   */
  private async manualUpdate(context: NcContext, body: any, req: NcRequest) {
    const { baseId } = body;

    if (!baseId) {
      NcError.get(context).badRequest('baseId is required');
    }

    const installedBase = await Base.get(context, baseId);
    if (!installedBase) {
      NcError.get(context).baseNotFound(baseId);
    }

    if (!installedBase.managed_app_id || installedBase.managed_app_master) {
      NcError.get(context).badRequest(
        'Manual update is only available on installed managed app instances',
      );
    }

    const managedApp = await ManagedApp.get(installedBase.managed_app_id);
    if (!managedApp) {
      NcError.get(context).notFound('ManagedApp not found');
    }

    const masterBase = await Base.get(
      { workspace_id: managedApp.fk_workspace_id, base_id: managedApp.base_id },
      managedApp.base_id,
    );
    if (!masterBase) {
      NcError.get(context).badRequest('Master base not found');
    }

    // Get latest published version
    const latestPublished = await ManagedAppVersion.getLatest(
      managedApp.id,
      ManagedAppVersionStatus.PUBLISHED,
    );
    if (!latestPublished) {
      NcError.get(context).badRequest('No published version available');
    }

    // Skip if already on latest
    if (installedBase.managed_app_version_id === latestPublished.id) {
      return { message: 'Already up to date' } as any;
    }

    const installedContext: NcContext = {
      workspace_id: installedBase.fk_workspace_id,
      base_id: installedBase.id,
    };
    const masterContext: NcContext = {
      workspace_id: masterBase.fk_workspace_id,
      base_id: masterBase.id,
    };

    const deploymentLog = await ManagedAppDeploymentLog.insert({
      fk_workspace_id: installedBase.fk_workspace_id,
      base_id: installedBase.id,
      fk_managed_app_id: managedApp.id,
      from_version_id: installedBase.managed_app_version_id,
      to_version_id: latestPublished.id,
      status: DeploymentStatus.IN_PROGRESS,
      deployment_type: DeploymentType.UPDATE,
      started_at: new Date().toISOString(),
    });

    try {
      const updateResult =
        await this.managedAppService.applyUpdatesToInstallation({
          masterBase,
          installedBase,
          req,
          masterContext,
          installedContext,
          newVersionId: latestPublished.id,
        });

      await ManagedAppDeploymentLog.update(deploymentLog.id, {
        status: DeploymentStatus.SUCCESS,
        completed_at: new Date().toISOString(),
        deployment_log: `Updated from ${updateResult.fromVersionId} to ${updateResult.toVersionId}`,
      });

      this.appHooksService.emit(AppEvents.MANAGED_APP_UPDATE_COMPLETE, {
        context: installedContext,
        req,
        managedApp: { id: managedApp.id, title: managedApp.title },
        installedBaseId: installedBase.id,
        version: { id: latestPublished.id, version: latestPublished.version },
      });

      return {
        message: 'Updated successfully',
        version: latestPublished.version,
      } as any;
    } catch (error) {
      await ManagedAppDeploymentLog.update(deploymentLog.id, {
        status: DeploymentStatus.FAILED,
        error_message: error.message,
        completed_at: new Date().toISOString(),
      });

      this.logger.error(
        `Manual update failed for base ${baseId}: ${error.message}`,
        error.stack,
      );

      throw error;
    }
  }
}
