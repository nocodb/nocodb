import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  NcApiVersion,
  type NcContext,
  type NcRequest,
  OnDeleteAction,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { Job } from 'bull';
import type {
  AuthIntegration,
  SyncIntegration,
} from '@noco-local-integrations/core';
import type { SyncDataSyncModuleJobData } from '~/interface/Jobs';
import { Integration, Model, SyncConfig, SyncMapping } from '~/models';
import { NcError } from '~/helpers/catchError';
import { TablesService } from '~/services/tables.service';
import { DataTableService } from '~/services/data-table.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';

@Injectable()
export class SyncModuleSyncDataProcessor {
  private logger: Logger = new Logger(SyncModuleSyncDataProcessor.name);

  constructor(
    protected readonly tablesService: TablesService,
    protected readonly dataTableService: DataTableService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
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

    // Typecast the data to the correct type
    req.query = {
      ...req.query,
      typecast: 'true',
    };

    if (toInsert.length > 0) {
      await this.dataTableService.dataInsert(context, {
        baseId: model.base_id,
        modelId: model.id,
        body: toInsert,
        cookie: req,
        apiVersion: NcApiVersion.V3,
        internalFlags: {
          allowSystemColumn: true,
          skipHooks: true,
        },
      });
    }

    if (toUpdate.length > 0) {
      await this.dataTableService.dataUpdate(context, {
        baseId: model.base_id,
        modelId: model.id,
        body: toUpdate,
        cookie: req,
        apiVersion: NcApiVersion.V3,
        internalFlags: {
          allowSystemColumn: true,
        },
      });
    }
  }

  async deleteStaleRecords(
    context: NcContext,
    syncConfig: SyncConfig,
    model: Model,
    syncRunId: string,
    onDeleteAction: OnDeleteAction | null,
    req: NcRequest,
  ) {
    let preserveDeleted = true;

    if (onDeleteAction) {
      preserveDeleted = onDeleteAction === OnDeleteAction.MarkDeleted;
    }

    // If the model is a junction table need to always delete
    if (model.mm) {
      preserveDeleted = false;
    }

    if (preserveDeleted) {
      // Mark records as deleted instead of actually deleting them
      await this.bulkDataAliasService.bulkDataUpdateAll(context, {
        baseName: model.base_id,
        tableName: model.id,
        cookie: req,
        body: {
          RemoteDeleted: true,
          RemoteDeletedAt: dayjs().utc().toISOString(),
        },
        query: {
          filterArr: [
            {
              comparison_op: 'neq',
              value: syncRunId,
              logical_op: 'and',
              fk_column_id: model.columns.find((c) => c.title === 'SyncRunId')
                ?.id,
            },
            {
              comparison_op: 'eq',
              value: syncConfig.id,
              logical_op: 'and',
              fk_column_id: model.columns.find(
                (c) => c.title === 'SyncConfigId',
              )?.id,
            },
            {
              comparison_op: 'eq',
              value: false,
              logical_op: 'and',
              fk_column_id: model.columns.find(
                (c) => c.title === 'RemoteDeleted',
              )?.id,
            },
          ],
        },
      });
    } else {
      // Delete records that no longer exist in the source
      await this.bulkDataAliasService.bulkDataDeleteAll(context, {
        baseName: model.base_id,
        tableName: model.id,
        req,
        query: {
          filterArr: [
            {
              comparison_op: 'neq',
              value: syncRunId,
              logical_op: 'and',
              fk_column_id: model.columns.find((c) => c.title === 'SyncRunId')
                ?.id,
            },
            {
              comparison_op: 'eq',
              value: syncConfig.id,
              logical_op: 'and',
              fk_column_id: model.columns.find(
                (c) => c.title === 'SyncConfigId',
              )?.id,
            },
          ],
        },
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

      const auth = await authWrapper.authenticate();

      const wrapper =
        await integration.getIntegrationWrapper<SyncIntegration>();

      const syncMappings = await SyncMapping.list(context, {
        fk_sync_config_id: syncConfig.id,
      });

      let recordCounter = 0;

      const modelSyncTargetMap = new Map<string, Model>();
      const modelIdSyncTargetMap = new Map<string, string>();

      for (const syncMap of syncMappings) {
        const model = await Model.get(context, syncMap.fk_model_id);

        if (!model) {
          NcError.genericNotFound('Model', syncMap.fk_model_id);
        }

        await model.getColumns(context);

        modelSyncTargetMap.set(syncMap.target_table, model);
        modelIdSyncTargetMap.set(model.id, syncMap.target_table);
      }

      const dataStream = await wrapper.fetchData(auth, {});

      const RemoteSyncedAt = dayjs().utc().toISOString();
      // Generate a unique ID for this sync run
      const syncRunId = uuidv4();

      const dataBuffers = new Map<string, Record<string, any>[]>();
      const linkBuffers = new Map<string, Record<string, any>[]>();

      const linkFieldsMap = new Map<
        string,
        {
          mmTable: Model;
          isParent: boolean;
        }
      >();

      let streamError: boolean = false;

      await new Promise<void>((resolve, reject) => {
        dataStream.on('data', async (data) => {
          try {
            const model = modelSyncTargetMap.get(data.targetTable);

            if (!model) {
              logBasic(
                `Model ${data.targetTable} not found, skipping this record`,
              );
              return;
            }

            if (!dataBuffers.has(model.id)) {
              dataBuffers.set(model.id, []);
            }

            Object.assign(data.data, {
              RemoteId: data.recordId,
              RemoteSyncedAt,
              SyncConfigId: syncConfig.id,
              SyncRunId: syncRunId,
              RemoteDeleted: false,
            });

            const dataBuffer = dataBuffers.get(model.id);

            dataBuffer.push(data.data);

            if (data.links) {
              const linkFields = Object.keys(data.links);

              for (const linkField of linkFields) {
                let linkFieldConfig = linkFieldsMap.get(
                  `${model.id}-${linkField}`,
                );

                if (!linkFieldConfig) {
                  // Get column
                  const column = model.columns.find(
                    (c) => c.title === linkField,
                  );

                  if (!column) {
                    continue;
                  }

                  const mmTable = await Model.get(
                    context,
                    column.colOptions.fk_mm_model_id,
                  );

                  if (!mmTable) {
                    continue;
                  }

                  await mmTable.getColumns(context);

                  modelSyncTargetMap.set(mmTable.id, mmTable);

                  const isParent = model.columns.find(
                    (c) => c.id === column.colOptions.fk_parent_column_id,
                  );

                  linkFieldConfig = {
                    mmTable,
                    isParent: !isParent,
                  };

                  linkFieldsMap.set(
                    `${model.id}-${linkField}`,
                    linkFieldConfig,
                  );
                }

                const linkArray: {
                  remote_id_parent: string;
                  remote_id_child: string;
                  RemoteId: string;
                  SyncConfigId: string;
                  RemoteSyncedAt: string;
                  SyncRunId: string;
                }[] = [];

                for (const record of data.links[linkField]) {
                  if (linkFieldConfig.isParent) {
                    linkArray.push({
                      remote_id_parent: record,
                      remote_id_child: data.recordId,
                      RemoteId: `${record}-${data.recordId}`,
                      SyncConfigId: syncConfig.id,
                      RemoteSyncedAt,
                      SyncRunId: syncRunId,
                    });
                  } else {
                    linkArray.push({
                      remote_id_parent: data.recordId,
                      remote_id_child: record,
                      RemoteId: `${data.recordId}-${record}`,
                      SyncConfigId: syncConfig.id,
                      RemoteSyncedAt,
                      SyncRunId: syncRunId,
                    });
                  }
                }

                if (!linkBuffers.has(linkFieldConfig.mmTable.id)) {
                  linkBuffers.set(linkFieldConfig.mmTable.id, []);
                }

                const linkBuffer = linkBuffers.get(linkFieldConfig.mmTable.id);

                linkBuffer.push(...linkArray);

                if (linkBuffer.length >= 100) {
                  dataStream.pause();

                  await this.pushData(
                    context,
                    syncConfig,
                    linkFieldConfig.mmTable,
                    linkBuffer.splice(0),
                    req,
                  );

                  dataStream.resume();
                }
              }
            }

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
          streamError = true;
          reject(error);
        });

        dataStream.on('end', async () => {
          try {
            for (const [modelId, dataBuffer] of dataBuffers.entries()) {
              const targetTable = modelIdSyncTargetMap.get(modelId);
              const model = modelSyncTargetMap.get(targetTable);

              if (!model) {
                logBasic(
                  `Model ${targetTable} not found, skipping this record`,
                );
                continue;
              }

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
            }

            for (const [mmTableId, linkBuffer] of linkBuffers.entries()) {
              if (linkBuffer.length > 0) {
                await this.pushData(
                  context,
                  syncConfig,
                  modelSyncTargetMap.get(mmTableId),
                  linkBuffer.splice(0),
                  req,
                );
              }
            }

            // Process deletions for records that no longer exist in the source
            // Use the syncRunId to identify records that weren't updated in this sync
            for (const [modelId, _] of modelSyncTargetMap.entries()) {
              const model = modelSyncTargetMap.get(modelId);

              // If there was an error, skip deleting records
              if (model && !streamError) {
                await this.deleteStaleRecords(
                  context,
                  syncConfig,
                  model,
                  syncRunId,
                  syncConfig.on_delete_action,
                  req,
                );
              }
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

            logBasic(`Sync Completed: ${recordCounter} records synced`);

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
