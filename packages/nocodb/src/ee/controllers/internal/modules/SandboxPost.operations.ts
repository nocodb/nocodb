import { Injectable } from '@nestjs/common';
import {
  BaseVersion,
  DeploymentStatus,
  DeploymentType,
  ProjectStatus,
  SandboxVersionStatus,
  SandboxVisibility,
} from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import Sandbox from '~/models/Sandbox';
import SandboxVersion from '~/models/SandboxVersion';
import { Base } from '~/models';
import { BasesService } from '~/services/bases.service';
import { SandboxService } from '~/services/sandbox.service';
import SandboxDeploymentLog from '~/models/SandboxDeploymentLog';
import Noco from '~/Noco';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import { serializeMeta } from '~/helpers/baseMetaHelpers';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class SandboxPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  httpMethod = 'POST' as const;
  operations = [
    'sandboxCreate',
    'sandboxUpdate',
    'sandboxDelete',
    'sandboxPublish',
    'sandboxCreateDraft',
    'sandboxInstall',
  ] as (keyof typeof OPERATION_SCOPES)[];

  constructor(
    private readonly sandboxService: SandboxService,
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
      case 'sandboxCreate':
        return await this.create(context, workspaceId, baseId, payload, req);
      case 'sandboxUpdate':
        return await this.update(context, payload, req);
      case 'sandboxDelete':
        return await this.delete(context, payload, req);
      case 'sandboxPublish':
        return await this.publish(context, payload, req);
      case 'sandboxCreateDraft':
        return await this.createDraft(context, payload, req);
      case 'sandboxInstall':
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
    // Check if base is already an installed sandbox instance
    const existingBase = await Base.get(context, baseId);
    if (existingBase?.sandbox_id && !existingBase?.sandbox_master) {
      NcError.get(context).badRequest(
        'Cannot create sandbox from an installed sandbox instance',
      );
    }

    // Validate base exists and belongs to workspace
    const base = await Base.get(context, baseId);
    if (!base) {
      NcError.get(context).baseNotFound(baseId);
    }

    if (base.fk_workspace_id !== workspaceId) {
      NcError.get(context).badRequest('Base does not belong to this workspace');
    }

    if (base.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        'Only V3 bases can be published as sandboxes',
      );
    }

    // Check if sandbox already exists for this base
    const existingSandbox = await Sandbox.getByBaseId(context, baseId);
    if (existingSandbox) {
      NcError.get(context).badRequest('A sandbox already exists for this base');
    }

    const sandbox = await Sandbox.insert(context, {
      ...body,
      base_id: baseId,
      fk_workspace_id: workspaceId,
      created_by: req.user.id,
      visibility: body.visibility || SandboxVisibility.PRIVATE,
    });

    // Mark the base as a sandbox master
    await Base.update(context, baseId, {
      sandbox_master: true,
      sandbox_id: sandbox.id,
    });

    // Create initial v1.0.0 draft version
    const sourceContext: NcContext = {
      workspace_id: workspaceId,
      base_id: baseId,
    };

    // Serialize current schema
    const serializedSchema = await serializeMeta(sourceContext);

    // Create version 1.0.0 as draft
    const initialVersion = await SandboxVersion.insert(context, {
      fk_sandbox_id: sandbox.id,
      version: '1.0.0',
      version_number: 1,
      status: SandboxVersionStatus.DRAFT,
      fk_workspace_id: workspaceId,
      schema: JSON.stringify(serializedSchema),
    });

    // Set the version on the base
    await Base.update(context, baseId, {
      sandbox_version_id: initialVersion.id,
    });

    return {
      ...sandbox,
      sandbox_id: sandbox.id,
      initial_version: initialVersion,
    };
  }

  private async update(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId, ...updateData } = body;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    const base = await Base.get(context, sandbox.base_id);
    if (base?.sandbox_id && !base?.sandbox_master) {
      NcError.get(context).badRequest(
        'Sandbox management operations are not allowed on installed sandbox instances',
      );
    }

    // Only owner can update
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can update this sandbox',
      );
    }

    // Allow updating: title, description, category, tags, visibility
    const updatedSandbox = await Sandbox.update(context, sandboxId, updateData);

    return updatedSandbox;
  }

  private async delete(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId } = body;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    const base = await Base.get(context, sandbox.base_id);
    if (base?.sandbox_id && !base?.sandbox_master) {
      NcError.get(context).badRequest(
        'Sandbox management operations are not allowed on installed sandbox instances',
      );
    }

    // Only owner can delete
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can delete this sandbox',
      );
    }

    await Sandbox.softDelete(context, sandboxId);

    return {
      message: 'Sandbox deleted successfully',
    } as any;
  }

  private async createDraft(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId, version } = body;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    if (!version) {
      NcError.get(context).badRequest('version is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId);
    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    const base = await Base.get(context, sandbox.base_id);
    if (!base?.sandbox_master) {
      NcError.get(context).badRequest(
        'Only sandbox masters can create new drafts',
      );
    }

    // Only owner can create drafts
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can create drafts for this sandbox',
      );
    }

    // Check if version already exists
    const existingVersion = await SandboxVersion.getByVersion(
      context,
      sandboxId,
      version,
    );
    if (existingVersion) {
      NcError.get(context).badRequest(
        `Version ${version} already exists for this sandbox`,
      );
    }

    // Create new draft version
    const newDraft = await SandboxVersion.insert(context, {
      fk_sandbox_id: sandboxId,
      version,
      status: SandboxVersionStatus.DRAFT,
      fk_workspace_id: context.workspace_id,
      schema: null,
    });

    // Update base to point to new draft
    await Base.update(context, base.id, {
      sandbox_version_id: newDraft.id,
    });

    return {
      message: 'New draft version created successfully',
      version: newDraft,
    } as any;
  }

  private async publish(context: NcContext, body: any, req: NcRequest) {
    const { sandboxVersionId } = body;

    if (!sandboxVersionId) {
      NcError.get(context).badRequest('sandboxVersionId is required');
    }

    // Get the version to publish
    const version = await SandboxVersion.get(context, sandboxVersionId);
    if (!version) {
      NcError.get(context).notFound('Sandbox version not found');
    }

    // Get the sandbox
    const sandbox = await Sandbox.get(context, version.fk_sandbox_id);
    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Only owner can publish
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can publish this sandbox',
      );
    }

    // Check if version is already published
    if (version.status === SandboxVersionStatus.PUBLISHED) {
      NcError.get(context).badRequest('Version is already published');
    }

    const base = await Base.get(context, sandbox.base_id);
    if (!base?.sandbox_master) {
      NcError.get(context).badRequest(
        'Only sandbox masters can publish versions',
      );
    }

    // Serialize current schema
    const sourceContext: NcContext = {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    };

    const serializedSchema = await serializeMeta(sourceContext);

    // Update version to published
    await Noco.ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_VERSIONS,
      {
        status: SandboxVersionStatus.PUBLISHED,
        published_at: new Date().toISOString(),
        schema: JSON.stringify(serializedSchema),
      },
      sandboxVersionId,
    );

    // Clear cache
    await NocoCache.del(
      context,
      `${CacheScope.SANDBOX_VERSION}:${sandboxVersionId}`,
    );

    // Update sandbox published_at if this is the first publish
    const isInitialPublish = !sandbox.published_at;
    if (isInitialPublish) {
      await Sandbox.update(context, sandbox.id, {
        published_at: new Date().toISOString(),
      });
    }

    // Apply updates to installations with auto_update=true
    await this.updateAllInstallations(context, sandbox.id, base, req);

    return {
      message: 'Version published successfully',
      sandboxId: sandbox.id,
      versionId: sandboxVersionId,
      version: version.version,
      isInitialPublish,
    } as any;
  }

  private async install(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId, target_workspace_id } = body;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    if (!target_workspace_id) {
      NcError.get(context).badRequest('target_workspace_id is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Can only install if sandbox has published versions
    if (!sandbox.published_at) {
      NcError.get(context).badRequest(
        'Only sandboxes with published versions can be installed',
      );
    }

    // Get the latest published version
    const versions = await SandboxVersion.list(context, sandboxId);
    const publishedVersions = versions.filter(
      (v) => v.status === SandboxVersionStatus.PUBLISHED,
    );

    if (!publishedVersions || publishedVersions.length === 0) {
      NcError.get(context).notFound(
        'No published versions found for this sandbox',
      );
    }

    // Use the latest published version
    const sandboxVersion = publishedVersions[0];

    // 1. Create new base in target workspace using BasesService
    const targetBase = await this.basesService.baseCreate({
      base: {
        title: sandbox.title,
        status: ProjectStatus.JOB,
        ...{ fk_workspace_id: target_workspace_id },
        version: BaseVersion.V3,
        // Mark as sandbox installation
        ...{
          sandbox_master: false,
          sandbox_id: sandboxId,
          sandbox_version_id: sandboxVersion.id,
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
    const deploymentLog = await SandboxDeploymentLog.insert({
      fk_workspace_id: target_workspace_id,
      base_id: targetBase.id,
      fk_sandbox_id: sandboxId,
      from_version_id: null, // Initial install
      to_version_id: sandboxVersion.id,
      status: DeploymentStatus.IN_PROGRESS,
      deployment_type: DeploymentType.INSTALL,
      started_at: new Date().toISOString(),
    });

    try {
      // 2. Use SandboxService to install from serialized schema
      await this.sandboxService.installFromSandbox({
        targetBase,
        targetContext,
        sandboxId,
      });

      // Mark deployment as successful
      await SandboxDeploymentLog.update(deploymentLog.id, {
        status: DeploymentStatus.SUCCESS,
        completed_at: new Date().toISOString(),
      });

      // Increment install count
      await Sandbox.incrementInstallCount(context, sandboxId);

      return {
        message: 'Sandbox installed successfully',
        sandboxId,
        version: sandboxVersion.version,
        sourceBaseId: sandbox.base_id,
        targetWorkspaceId: target_workspace_id,
        installedBaseId: targetBase.id,
        installedBase: {
          id: targetBase.id,
          title: targetBase.title,
          sandbox_master: false,
          sandbox_id: sandboxId,
          sandbox_version_id: sandboxVersion.id,
          auto_update: true,
        },
      } as any;
    } catch (error) {
      // Mark deployment as failed
      await SandboxDeploymentLog.update(deploymentLog.id, {
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
   * Isolated method to update all installations of a sandbox
   * Can be called manually or automatically during publish
   * In the future, this can be replaced with a pull-based approach
   */
  private async updateAllInstallations(
    context: NcContext,
    sandboxId: string,
    masterBase: Base,
    req: NcRequest,
  ) {
    // Get the new version ID from the master base
    const newVersionId = masterBase.sandbox_version_id;

    // Find all bases that were installed from this sandbox (have sandbox_id and sandbox_master=false)
    const installedBases = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .where('sandbox_id', sandboxId)
      .where('sandbox_master', (qb) => {
        qb.where(false).orWhereNull();
      })
      .where('deleted', (qb) => {
        qb.where(false).orWhereNull();
      })
      .where('is_snapshot', (qb) => {
        qb.where(false).orWhereNull();
      })
      .where('auto_update', true);

    if (!installedBases || installedBases.length === 0) {
      return {
        message: 'No installations found',
        sandboxId,
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
          `Applying updates to installed base ${installedBaseData.id} from sandbox ${sandboxId}`,
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

        // Create deployment log
        deploymentLog = await SandboxDeploymentLog.insert({
          fk_workspace_id: installedBase.fk_workspace_id,
          base_id: installedBase.id,
          fk_sandbox_id: sandboxId,
          from_version_id: installedBase.sandbox_version_id,
          to_version_id: newVersionId,
          status: DeploymentStatus.IN_PROGRESS,
          deployment_type: DeploymentType.UPDATE,
          started_at: new Date().toISOString(),
        });

        // Use the SandboxService to apply metadata diff and update version
        const updateResult =
          await this.sandboxService.applyUpdatesToInstallation({
            masterBase,
            installedBase,
            req,
            masterContext,
            installedContext,
            newVersionId, // Pass the new version ID to update
          });

        // Mark deployment as successful
        await SandboxDeploymentLog.update(deploymentLog.id, {
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
          await SandboxDeploymentLog.update(deploymentLog.id, {
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
      sandboxId,
      totalInstallations: installedBases.length,
      successfulUpdates: results.length,
      failedUpdates: errors.length,
      results,
      errors,
    };
  }
}
