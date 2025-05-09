import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { type NcContext, type NcRequest, SyncType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { AuthIntegration, SyncIntegration } from '@noco-local-integrations/core';
import type { SyncDataSyncModuleJobData } from '~/interface/Jobs';
import { Integration, Model, SyncConfig } from '~/models';
import { NcError } from '~/helpers/catchError';
import { TablesService } from '~/services/tables.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { DataTableService } from '~/services/data-table.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';

@Injectable()
export class SyncModuleSyncDataProcessor {
  private logger: Logger = new Logger(SyncModuleSyncDataProcessor.name);

  constructor(
    protected readonly tablesService: TablesService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
    protected readonly dataTableService: DataTableService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  async pushData(
    context: NcContext,
    syncConfig: SyncConfig,
    model: Model,
    data: any[],
    req: NcRequest,
  ) {
    const toInsert = [];
    const toUpdate = [];

    const existingRecords = await this.dataTableService.dataList(context, {
      baseId: model.base_id,
      modelId: model.id,
      query: {
        filterArrJson: JSON.stringify([
          {
            comparison_op: 'eq',
            value: syncConfig.id,
            logical_op: 'and',
            fk_column_id: model.columns.find((c) => c.title === 'SyncConfigId')
              ?.id,
          },
          {
            comparison_op: 'in',
            value: data.map((d) => d.RemoteId),
            logical_op: 'and',
            fk_column_id: model.columns.find((c) => c.title === 'RemoteId')?.id,
          },
        ]),
      },
      ignorePagination: true,
    });

    const dataMap = new Map<string, any>();
    const existingMap = new Map<string, any>();
    const toInsertMap = new Map<string, boolean>();

    for (const record of data) {
      dataMap.set(record.RemoteId, record);
    }

    for (const record of existingRecords.list) {
      existingMap.set(record.RemoteId, record);
    }

    for (const record of data) {
      const dataRecord = dataMap.get(record.RemoteId);
      const existingRecord = existingMap.get(record.RemoteId);

      if (!existingRecord) {
        if (toInsertMap.has(record.RemoteId)) {
          continue;
        }

        toInsert.push(dataRecord);
        toInsertMap.set(record.RemoteId, true);
      } else {
        // If the remote is not updated, skip
        if (dataRecord.RemoteRaw === existingRecord.RemoteRaw) {
          continue;
        }

        toUpdate.push(
          Object.assign(dataRecord, {
            Id: existingRecord.Id,
          }),
        );
      }
    }

    if (toInsert.length > 0) {
      await this.bulkDataAliasService.bulkDataInsert(context, {
        baseName: model.base_id,
        tableName: model.id,
        body: toInsert,
        cookie: req,
        skip_hooks: true,
        allowSystemColumn: true,
      });
    }

    if (toUpdate.length > 0) {
      await this.bulkDataAliasService.bulkDataUpdate(context, {
        baseName: model.base_id,
        tableName: model.id,
        body: toUpdate,
        cookie: req,
        allowSystemColumn: true,
      });
    }
  }

  async job(job: Job<SyncDataSyncModuleJobData>) {
    const { context, syncConfigId, trigger: _trigger, req } = job.data;

    const logBasic = (message: string) => {
      this.jobsLogService.sendLog(job, {
        message,
      });
    };

    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    if (syncConfig.sync_job_id && syncConfig.sync_job_id !== `${job.id}`) {
      NcError.badRequest('Another job is already running');
    }

    try {
      const integration = await Integration.get(
        context,
        syncConfig.fk_integration_id,
      );

      if (!integration) {
        NcError.genericNotFound('Integration', syncConfig.fk_integration_id);
      }

      const model = await Model.get(context, syncConfig.fk_model_id);

      if (!model) {
        NcError.genericNotFound('Model', syncConfig.fk_model_id);
      }

      await model.getColumns(context);

      const authIntegration = await Integration.get(
        context,
        integration.getConfig().authIntegrationId,
      );

      if (!authIntegration) {
        NcError.genericNotFound(
          'AuthIntegration',
          integration.getConfig().authIntegrationId,
        );
      }

      const authWrapper =
        await authIntegration.getIntegrationWrapper<AuthIntegration>();

      const auth = await authWrapper.authenticate(authIntegration.getConfig());

      const wrapper =
        await integration.getIntegrationWrapper<SyncIntegration>();

      let lastRecord;

      if (syncConfig.sync_type === SyncType.Incremental) {
        const incrementalKey = wrapper.getIncrementalKey();

        // get latest record synced using incremental key
        const lastRecords = await this.dataTableService.dataList(context, {
          baseId: model.base_id,
          modelId: model.id,
          query: {
            filterArrJson: JSON.stringify([
              {
                comparison_op: 'eq',
                value: syncConfig.id,
                logical_op: 'and',
                fk_column_id: model.columns.find(
                  (c) => c.title === 'SyncConfigId',
                )?.id,
              },
            ]),
            sort: {
              columnId: model.columns.find((c) => c.title === incrementalKey)
                ?.id,
              order: 'desc',
            },
            limit: 1,
          },
        });

        if (lastRecords.list.length > 0) {
          lastRecord = lastRecords.list[0];
        }
      }

      logBasic(
        `Started syncing your data from ${integration.title} (${integration.sub_type}) to ${model.title}`,
      );

      const dataStream = await wrapper.fetchData(
        auth,
        integration.getConfig(),
        {
          last_record: lastRecord,
        },
      );

      let recordCounter = 0;

      const RemoteSyncedAt = dayjs().utc().toISOString();

      const dataBuffer: Record<string, any>[] = [];

      await new Promise<void>((resolve, reject) => {
        dataStream.on('data', async (data) => {
          try {
            Object.assign(data.data, {
              RemoteId: data.recordId,
              RemoteSyncedAt,
              SyncConfigId: syncConfig.id,
            });

            dataBuffer.push(data.data);

            if (dataBuffer.length >= 100) {
              dataStream.pause();

              recordCounter += dataBuffer.length;

              await this.pushData(
                context,
                syncConfig,
                model,
                dataBuffer.splice(0),
                req,
              );

              logBasic(`Synced ${recordCounter} records`);

              dataStream.resume();
            }
          } catch (error) {
            reject(error);
          }
        });

        dataStream.on('error', async (error) => {
          reject(error);
        });

        dataStream.on('end', async () => {
          try {
            if (dataBuffer.length > 0) {
              recordCounter += dataBuffer.length;

              await this.pushData(
                context,
                syncConfig,
                model,
                dataBuffer.splice(0),
                req,
              );

              logBasic(`Synced ${recordCounter} records`);
            }

            await SyncConfig.update(context, syncConfig.id, {
              sync_job_id: null,
              last_sync_at: RemoteSyncedAt,
              next_sync_at: await SyncConfig.calculateNextSyncAt(
                context,
                syncConfig.id,
                new Date(RemoteSyncedAt),
              ),
            });

            logBasic(`Sync Completed`);

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      await SyncConfig.update(context, syncConfig.id, {
        sync_job_id: null,
        next_sync_at: await SyncConfig.calculateNextSyncAt(
          context,
          syncConfig.id,
        ),
      });

      throw error;
    }
  }
}
