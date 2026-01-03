import { Injectable } from '@nestjs/common';
import { BaseVersion } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Base } from '~/models';
import { DuplicateProcessor } from '~/ee/modules/jobs/jobs/export-import/duplicate.processor';
import { JobTypes } from '~/interface/Jobs';
import Sandbox from '~/ee/models/Sandbox';
import Noco from '~/Noco';
import { applyMeta, diffMeta, serializeMeta } from '~/helpers/baseMetaHelpers';

@Injectable()
export class SandboxService {
  constructor(private readonly duplicateProcessor: DuplicateProcessor) {}

  /**
   * Install a sandbox by duplicating the source base to a target workspace
   * This is similar to duplicateBaseJob but excludes data and comments,
   * and marks the installed base with sandbox metadata
   */
  async installSandbox({
    sourceBase,
    targetBase,
    dataSource,
    req,
    context,
    targetContext,
    sandboxId,
  }: {
    sourceBase: Base;
    targetBase: Base;
    dataSource: any;
    req: NcRequest;
    context: NcContext;
    targetContext: NcContext;
    sandboxId: string;
  }) {
    // Validate that source and target are V3 bases
    if (sourceBase.version !== BaseVersion.V3) {
      throw new Error('Only V3 bases can be used as sandbox sources');
    }

    if (targetBase.version !== BaseVersion.V3) {
      throw new Error('Target base must be V3');
    }

    // Note: We don't validate sandbox markers on targetBase here because
    // the Base object returned from basesService.baseCreate() may not include
    // the custom fields. The markers are validated at the database level
    // and in the controller before calling this service.

    // Use DuplicateProcessor with sandbox-specific options
    await this.duplicateProcessor.duplicateBaseJob({
      sourceBase,
      targetBase,
      dataSource,
      req,
      context,
      targetContext,
      options: {
        excludeData: true, // Skip data for sandbox installations
        excludeHooks: false, // Include hooks
        excludeViews: false, // Include views
        excludeComments: true, // Skip comments for sandbox installations
        excludeUsers: true, // Skip users for sandbox installations
        excludeScripts: false, // Include scripts
        excludeDashboards: false, // Include dashboards
      },
      operation: JobTypes.DuplicateBase,
    });

    // Increment the install count for the sandbox
    await Sandbox.incrementInstallCount(context, sandboxId);

    return {
      success: true,
      installedBaseId: targetBase.id,
      sandboxId,
    };
  }

  /**
   * Apply metadata updates from master sandbox to an installed base
   * Uses meta diff/apply approach to synchronize schema changes
   */
  async applyUpdatesToInstallation({
    masterBase,
    installedBase,
    masterContext,
    installedContext,
  }: {
    masterBase: Base;
    installedBase: Base;
    req: NcRequest;
    masterContext: NcContext;
    installedContext: NcContext;
  }) {
    // Validate that both are V3 bases
    if (masterBase.version !== BaseVersion.V3) {
      throw new Error('Master base must be V3');
    }

    if (installedBase.version !== BaseVersion.V3) {
      throw new Error('Installed base must be V3');
    }

    // Get target base's primary source for proper source_id override
    const installedSources = await installedBase.getSources();
    const installedSourceId = installedSources?.[0]?.id;

    if (!installedSourceId) {
      throw new Error(`No sources found in installed base ${installedBase.id}`);
    }

    // Serialize metadata from both bases
    const masterMeta = await serializeMeta(masterContext, {
      override: {
        fk_workspace_id: installedContext.workspace_id,
        base_id: installedContext.base_id,
        source_id: installedSourceId, // Map to installed base's source
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

    // Calculate diff (installed is "current", master is "new")
    const diff = await diffMeta(installedMeta, masterMeta);

    // Apply the diff in a transaction
    let trx;
    try {
      trx = await Noco.ncMeta.startTransaction();

      await applyMeta(installedContext, diff, trx);

      await trx.commit();

      return {
        success: true,
        baseId: installedBase.id,
        diff,
      };
    } catch (error) {
      if (trx) {
        await trx.rollback();
      }
      throw error;
    }
  }
}
