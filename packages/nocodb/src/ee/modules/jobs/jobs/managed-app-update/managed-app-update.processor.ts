import { Injectable, Logger } from '@nestjs/common';
import { AppEvents, DeploymentStatus, DeploymentType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { ManagedAppUpdateJobData } from '~/interface/Jobs';
import type { NcContext } from '~/interface/config';
import { Base } from '~/models';
import { NcError } from '~/helpers/catchError';
import ManagedAppDeploymentLog from '~/models/ManagedAppDeploymentLog';
import { ManagedAppService } from '~/services/managed-app.service';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class ManagedAppUpdateProcessor {
  private readonly logger = new Logger(ManagedAppUpdateProcessor.name);

  constructor(
    private readonly managedAppService: ManagedAppService,
    private readonly appHooksService: AppHooksService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  async job(job: Job<ManagedAppUpdateJobData>) {
    const {
      managedAppId,
      managedAppTitle,
      masterBaseId,
      masterWorkspaceId,
      newVersionId,
      newVersion,
      req,
    } = job.data;

    // Find all installed bases with auto_update=true
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
        managedAppId,
        totalInstallations: 0,
        successfulUpdates: 0,
        failedUpdates: 0,
      };
    }

    const masterBase = await Base.get(
      { workspace_id: masterWorkspaceId, base_id: masterBaseId },
      masterBaseId,
    );

    if (!masterBase) {
      NcError.baseNotFound(masterBaseId);
    }

    const results = [];
    const errors = [];

    // Filter out master base upfront
    const basesToUpdate = installedBases.filter((b) => b.id !== masterBaseId);
    const total = basesToUpdate.length;
    let processed = 0;

    this.jobsLogService.sendLog(job, {
      message: `Updating 0/${total} installations`,
    });

    for (const installedBaseData of basesToUpdate) {
      let deploymentLog;
      try {
        this.logger.log(
          `Updating installed base ${installedBaseData.id} from managed app ${managedAppId}`,
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

        const updateResult =
          await this.managedAppService.applyUpdatesToInstallation({
            masterBase,
            installedBase,
            req,
            masterContext,
            installedContext,
            newVersionId,
          });

        // Mark deployment as successful
        await ManagedAppDeploymentLog.update(deploymentLog.id, {
          status: DeploymentStatus.SUCCESS,
          completed_at: new Date().toISOString(),
          deployment_log: `Updated from version ${updateResult.fromVersionId} to ${updateResult.toVersionId}`,
        });

        this.appHooksService.emit(AppEvents.MANAGED_APP_UPDATE_COMPLETE, {
          context: installedContext,
          req,
          managedApp: { id: managedAppId, title: managedAppTitle },
          installedBaseId: installedBase.id,
          version: { id: newVersionId, version: newVersion },
        });

        this.logger.log(`Updated installed base ${installedBaseData.id}`);

        results.push({
          baseId: installedBase.id,
          title: installedBase.title,
          status: 'success',
        });

        processed++;
        this.jobsLogService.sendLog(job, {
          message: `Updated ${processed}/${total} installations`,
        });
      } catch (error) {
        this.logger.error(
          `Failed to update installed base ${installedBaseData.id}: ${error.message}`,
          error.stack,
        );

        if (deploymentLog) {
          await ManagedAppDeploymentLog.update(deploymentLog.id, {
            status: DeploymentStatus.FAILED,
            error_message: error.message,
            completed_at: new Date().toISOString(),
          });
        }

        this.appHooksService.emit(AppEvents.MANAGED_APP_UPDATE_FAIL, {
          context: {
            workspace_id: installedBaseData.fk_workspace_id,
            base_id: installedBaseData.id,
          },
          req,
          managedApp: { id: managedAppId, title: managedAppTitle },
          installedBaseId: installedBaseData.id,
          version: { id: newVersionId, version: newVersion },
          error: error.message,
        });

        errors.push({
          baseId: installedBaseData.id,
          title: installedBaseData.title,
          error: error.message,
        });

        processed++;
        this.jobsLogService.sendLog(job, {
          message: `Updated ${processed}/${total} installations (${errors.length} failed)`,
        });
      }
    }

    return {
      managedAppId,
      totalInstallations: installedBases.length,
      successfulUpdates: results.length,
      failedUpdates: errors.length,
      results,
      errors,
    };
  }
}
