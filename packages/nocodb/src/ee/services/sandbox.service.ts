import { Injectable } from '@nestjs/common';
import { BaseVersion } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { MetaTable } from '~/utils/globals';
import { Base } from '~/models';
import Sandbox from '~/models/Sandbox';
import SandboxVersion from '~/models/SandboxVersion';
import Noco from '~/Noco';
import {
  applyMeta,
  type BaseMetaSchema,
  diffMeta,
  serializeMeta,
  skipOverrideTables,
} from '~/helpers/baseMetaHelpers';

@Injectable()
export class SandboxService {
  constructor() {}

  /**
   * Install a sandbox from a serialized schema (published version)
   * This uses the stored snapshot instead of the live base
   */
  async installFromSandbox({
    targetContext,
    targetBase,
    sandboxId,
  }: {
    targetContext: NcContext;
    targetBase: Base;
    sandboxId: string;
  }) {
    // Validate that target is V3 base
    if (targetBase.version !== BaseVersion.V3) {
      throw new Error('Target base must be V3');
    }

    const sandboxVersion = await SandboxVersion.getLatest(sandboxId);

    if (!sandboxVersion) {
      throw new Error('Published sandbox version not found');
    }

    const serializedSchema = sandboxVersion.getParsedSchema();

    // Get the target base's primary source (where tables will be created)
    const targetSources = await targetBase.getSources();
    if (!targetSources || targetSources.length === 0) {
      throw new Error('Target base has no sources');
    }
    const targetSourceId = targetSources[0].id; // Use primary source

    // Apply the serialized schema to the target base
    let trx;
    try {
      trx = await Noco.ncMeta.startTransaction();

      // Remap source_id in the schema to target base's source
      const remappedSchema = this.remapSourceId(
        serializedSchema,
        targetSourceId,
      );

      // For a fresh install, create a diff where everything is in the "add" section
      // The target base is empty, so we're adding all schema from the published version
      const metaDiff = {
        add: remappedSchema,
        delete: {},
        update: {},
      };

      await applyMeta(targetContext, metaDiff, trx);

      await trx.commit();

      // Increment the install count for the sandbox
      await Sandbox.incrementInstallCount(targetContext, sandboxId);

      return {
        success: true,
        installedBaseId: targetBase.id,
        sandboxId,
      };
    } catch (error) {
      if (trx) {
        await trx.rollback();
      }
      throw error;
    }
  }

  /**
   * Apply metadata updates from master sandbox to an installed base
   * Uses meta diff/apply approach to synchronize schema changes
   * Also updates the installed base's sandbox_version_id to reflect the new version
   */
  async applyUpdatesToInstallation({
    masterBase,
    installedBase,
    masterContext,
    installedContext,
    newVersionId,
  }: {
    masterBase: Base;
    installedBase: Base;
    req: NcRequest;
    masterContext: NcContext;
    installedContext: NcContext;
    newVersionId?: string; // The new version ID to update to
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
    let trx: MetaService;
    try {
      trx = await Noco.ncMeta.startTransaction();

      await applyMeta(installedContext, diff, trx);

      // If a new version ID is provided, update the installed base's sandbox_version_id
      if (newVersionId) {
        await Base.update(
          installedContext,
          installedBase.id,
          {
            sandbox_version_id: newVersionId,
          },
          trx,
        );
      }

      await trx.commit();

      return {
        success: true,
        baseId: installedBase.id,
        fromVersionId: installedBase.sandbox_version_id,
        toVersionId: newVersionId,
        diff,
      };
    } catch (error) {
      if (trx) {
        await trx.rollback();
      }
      throw error;
    }
  }

  /**
   * Remap source_id in a serialized schema to a different source
   * This is needed when installing a sandbox to a different base
   * Similar to the override logic in serializeMeta
   */
  private remapSourceId(
    schema: BaseMetaSchema,
    newSourceId: string,
  ): BaseMetaSchema {
    const remapped = {} as BaseMetaSchema;

    for (const [tableName, records] of Object.entries(schema)) {
      if (!Array.isArray(records)) {
        remapped[tableName] = records;
        continue;
      }

      if (skipOverrideTables.includes(tableName as MetaTable)) {
        remapped[tableName] = records;
        continue;
      }

      // Remap source_id for records that have it
      remapped[tableName] = records.map((record: any) => {
        if (record.source_id !== undefined) {
          return { ...record, source_id: newSourceId };
        }
        return record;
      });
    }

    return remapped;
  }
}
