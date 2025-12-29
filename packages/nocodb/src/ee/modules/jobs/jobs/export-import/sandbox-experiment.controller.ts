import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseVersion } from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { Base } from '~/models';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcContext, NcRequest } from '~/interface/config';
import Noco from '~/Noco';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { applyMeta, diffMeta, serializeMeta } from '~/helpers/baseMetaHelpers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SandboxExperimentController {
  private readonly debugLog = (...args: any[]) =>
    console.log(`[SandboxExperimentController]`, ...args);

  @Post(['/api/v2/meta/diff/:baseId/:targetBaseId'])
  @HttpCode(200)
  @Acl('metaDiff', {
    scope: 'base',
  })
  async applyMetaDiff(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') sourceBaseId: string,
    @Param('targetBaseId') targetBaseId: string,
    @Query('apply') apply?: string,
    @Body()
    body?: {
      apply?: boolean;
      diff?: any; // Optional: allow passing pre-calculated diff
    },
  ) {
    const shouldApply = apply === 'true' || body?.apply === true;

    this.debugLog(
      `Meta diff request: source=${sourceBaseId}, target=${targetBaseId}, apply=${shouldApply}`,
    );

    // Load both bases
    const sourceBase = await Base.get(context, sourceBaseId);
    if (!sourceBase) {
      NcError.get(context).baseNotFound(sourceBaseId);
    }

    const targetBase = await Base.get(context, targetBaseId);
    if (!targetBase) {
      NcError.get(context).baseNotFound(targetBaseId);
    }

    // Only support V3 bases
    if (sourceBase.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        `Source base must be version ${BaseVersion.V3}`,
      );
    }

    if (targetBase.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        `Target base must be version ${BaseVersion.V3}`,
      );
    }

    const sourceContext: NcContext = {
      workspace_id: sourceBase.fk_workspace_id,
      base_id: sourceBase.id,
    };

    const targetContext: NcContext = {
      workspace_id: targetBase.fk_workspace_id,
      base_id: targetBase.id,
    };

    let trx;
    try {
      // Calculate or use provided diff
      let diff;
      if (body?.diff) {
        this.debugLog('Using provided diff');
        diff = body.diff;
      } else {
        // Get target base's primary source for proper source_id override
        const targetSources = await targetBase.getSources();
        const targetSourceId = targetSources?.[0]?.id;

        if (!targetSourceId) {
          throw new Error(`No sources found in target base ${targetBase.id}`);
        }

        // Serialize metadata from both bases
        this.debugLog('Serializing source metadata');
        const sourceMeta = await serializeMeta(sourceContext, {
          override: {
            fk_workspace_id: targetContext.workspace_id,
            base_id: targetContext.base_id,
            source_id: targetSourceId, // Map to target base's source
          },
          ...(sourceBase.prefix
            ? {
                prefix: {
                  old: sourceBase.prefix,
                  new: targetBase.prefix || '',
                },
              }
            : {}),
        });

        this.debugLog('Serializing target metadata');
        const targetMeta = await serializeMeta(targetContext);

        // Calculate diff
        this.debugLog('Calculating metadata diff');
        diff = await diffMeta(targetMeta, sourceMeta);
      }

      if (!shouldApply) {
        // Just return the diff without applying
        this.debugLog('Returning diff without applying');
        return {
          sourceBase: {
            id: sourceBase.id,
            title: sourceBase.title,
            version: sourceBase.version,
          },
          targetBase: {
            id: targetBase.id,
            title: targetBase.title,
            version: targetBase.version,
          },
          diff,
          applied: false,
        };
      }

      // Apply the diff
      this.debugLog('Starting transaction to apply diff');
      trx = await Noco.ncMeta.startTransaction();

      await applyMeta(targetContext, diff, trx, {
        progressCallback: (step, progress) => {
          this.debugLog(`Progress: ${step} (${progress}%)`);
        },
      });

      await trx.commit();
      this.debugLog('Diff applied successfully');

      return {
        sourceBase: {
          id: sourceBase.id,
          title: sourceBase.title,
          version: sourceBase.version,
        },
        targetBase: {
          id: targetBase.id,
          title: targetBase.title,
          version: targetBase.version,
        },
        diff,
        applied: true,
        message: 'Metadata diff applied successfully',
      };
    } catch (error) {
      this.debugLog('Error processing meta diff:', error);
      if (trx) {
        this.debugLog('Rolling back transaction');
        await trx.rollback();
      }
      throw error;
    }
  }
}
