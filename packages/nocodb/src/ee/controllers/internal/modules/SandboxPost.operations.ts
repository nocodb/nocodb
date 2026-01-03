import { Injectable } from '@nestjs/common';
import { BaseVersion, ProjectStatus } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import Sandbox, { SandboxStatus, SandboxVisibility } from '~/ee/models/Sandbox';
import SandboxVersion from '~/ee/models/SandboxVersion';
import { Base } from '~/models';
import { BasesService } from '~/services/bases.service';
import { SandboxService } from '~/ee/services/sandbox.service';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { serializeMeta } from '~/helpers/baseMetaHelpers';

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
    'sandboxInstall',
    'sandboxApplyUpdates',
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
      case 'sandboxInstall':
        return await this.install(context, payload, req);
      case 'sandboxApplyUpdates':
        return await this.applyUpdates(context, payload, req);
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
      status: SandboxStatus.DRAFT,
      visibility: body.visibility || SandboxVisibility.PRIVATE,
    });

    return sandbox;
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

  private async publish(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId, version, releaseNotes } = body;

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

    // Only owner can publish
    if (sandbox.created_by !== req.user.id) {
      NcError.get(context).unauthorized(
        'Only the owner can publish this sandbox',
      );
    }

    const baseToPublish = await Base.get(context, sandbox.base_id);
    if (!baseToPublish) {
      NcError.get(context).baseNotFound(sandbox.base_id);
    }

    if (baseToPublish.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        'Only V3 bases can be published as sandboxes',
      );
    }

    // Check if this version already exists
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

    // Get the next version number for ordering
    const versionNumber = await SandboxVersion.getNextVersionNumber(
      context,
      sandboxId,
    );

    // Create source context for serialization
    const sourceContext: NcContext = {
      workspace_id: baseToPublish.fk_workspace_id,
      base_id: baseToPublish.id,
    };

    // Serialize the base metadata for this version
    const serializedSchema = await serializeMeta(sourceContext);

    // Create a version record with the serialized schema
    await SandboxVersion.insert(context, {
      fk_sandbox_id: sandboxId,
      version: version,
      version_number: versionNumber,
      fk_workspace_id: context.workspace_id,
      schema: JSON.stringify(serializedSchema),
      release_notes: releaseNotes,
    });

    // Determine if this is initial publish or subsequent publish
    const isInitialPublish = sandbox.status !== SandboxStatus.PUBLISHED;

    // Update sandbox to published status with new version
    const updatedSandbox = await Sandbox.update(context, sandboxId, {
      status: SandboxStatus.PUBLISHED,
      version: version,
      published_at: isInitialPublish
        ? new Date().toISOString()
        : sandbox.published_at,
    });

    let updateResults = null;

    // If this is a subsequent publish, automatically update all installations
    if (!isInitialPublish) {
      try {
        updateResults = await this.updateAllInstallations(
          context,
          sandboxId,
          baseToPublish,
          req,
        );
      } catch (error) {
        console.error(
          `Failed to update installations after publish: ${error.message}`,
        );
        // Don't fail the publish if updates fail - return partial results
        updateResults = {
          error: error.message,
          message: 'Version published but failed to update installations',
        };
      }
    }

    return {
      ...updatedSandbox,
      isInitialPublish,
      updateResults,
    } as any;
  }

  private async install(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId, target_workspace_id } = body;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Can only install published sandboxes
    if (sandbox.status !== SandboxStatus.PUBLISHED) {
      NcError.get(context).badRequest(
        'Only published sandboxes can be installed',
      );
    }

    // Get the published version schema
    const sandboxVersion = await SandboxVersion.getByVersion(
      context,
      sandboxId,
      sandbox.version,
    );

    if (!sandboxVersion) {
      NcError.get(context).notFound(
        `Published version ${sandbox.version} not found for this sandbox`,
      );
    }

    // 1. Create new base in target workspace using BasesService
    const targetBase = await this.basesService.baseCreate({
      base: {
        title: sandbox.title,
        status: ProjectStatus.JOB,
        ...{ fk_workspace_id: target_workspace_id },
        version: BaseVersion.V3,
        // Mark as sandbox installation
        ...{
          sandbox_id: sandboxId,
          sandbox_source_id: sandbox.base_id,
          schema_locked: true,
        },
      },
      user: { id: req.user.id },
      req: { user: { id: req.user.id } } as any,
    });

    const targetContext: NcContext = {
      workspace_id: target_workspace_id,
      base_id: targetBase.id,
    };

    try {
      // 2. Use SandboxService to install from serialized schema
      await this.sandboxService.installFromSandbox({
        targetBase,
        targetContext,
        sandboxId,
      });

      return {
        message: 'Sandbox installed successfully',
        sandboxId,
        version: sandbox.version,
        sourceBaseId: sandbox.base_id,
        targetWorkspaceId: target_workspace_id,
        installedBaseId: targetBase.id,
        installedBase: {
          id: targetBase.id,
          title: targetBase.title,
          schema_locked: true,
          sandbox_id: sandboxId,
          sandbox_source_id: sandbox.base_id,
        },
      } as any;
    } catch (error) {
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
    // Find all bases that were installed from this sandbox
    const installedBases = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT)
      .where('sandbox_source_id', masterBase.id);

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

        // Use the SandboxService to apply metadata diff
        await this.sandboxService.applyUpdatesToInstallation({
          masterBase,
          installedBase,
          req,
          masterContext,
          installedContext,
        });

        console.log(
          `Successfully applied updates to installed base ${installedBaseData.id}`,
        );

        results.push({
          baseId: installedBase.id,
          title: installedBase.title,
          status: 'success',
        });
      } catch (error) {
        console.error(
          `Failed to apply updates to installed base ${installedBaseData.id}:`,
          error,
        );

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

  private async applyUpdates(context: NcContext, body: any, req: NcRequest) {
    const { sandboxId } = body;

    if (!sandboxId) {
      NcError.get(context).badRequest('sandboxId is required');
    }

    const sandbox = await Sandbox.get(context, sandboxId);

    if (!sandbox) {
      NcError.get(context).notFound('Sandbox not found');
    }

    // Can only apply updates to published sandboxes
    if (sandbox.status !== SandboxStatus.PUBLISHED) {
      NcError.get(context).badRequest(
        'Only published sandboxes can have updates applied',
      );
    }

    const masterBase = await Base.get(context, sandbox.base_id);
    if (!masterBase) {
      NcError.get(context).baseNotFound(sandbox.base_id);
    }

    if (masterBase.version !== BaseVersion.V3) {
      NcError.get(context).badRequest('Only V3 bases can be used as sandboxes');
    }

    // Use the isolated method to update all installations
    const results = await this.updateAllInstallations(
      context,
      sandboxId,
      masterBase,
      req,
    );

    return results as any;
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
}
