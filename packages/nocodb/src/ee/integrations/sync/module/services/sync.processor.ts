import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import {
  NcApiVersion,
  type NcContext,
  type NcRequest,
  OnDeleteAction,
  SyncType,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { syncSystemFieldsMap } from '@noco-local-integrations/core';
import type {
  AuthIntegration,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-local-integrations/core';
import type { Job } from 'bull';
import type { SyncDataSyncModuleJobData } from '~/interface/Jobs';
import type { Column } from '~/models';
import { Integration, Model, SyncConfig, SyncMapping } from '~/models';
import { NcError } from '~/helpers/catchError';
import { TablesService } from '~/services/tables.service';
import { DataTableService } from '~/services/data-table.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { ColumnsService } from '~/services/columns.service';

@Injectable()
export class SyncModuleSyncDataProcessor {
  private logger: Logger = new Logger(SyncModuleSyncDataProcessor.name);

  constructor(
    protected readonly tablesService: TablesService,
    protected readonly dataTableService: DataTableService,
    protected readonly bulkDataAliasService: BulkDataAliasService,
    private readonly jobsLogService: JobsLogService,
    private readonly columnsService: ColumnsService,
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
    req: NcRequest,
  ) {
    let preserveDeleted = true;

    if (syncConfig.on_delete_action) {
      preserveDeleted =
        syncConfig.on_delete_action === OnDeleteAction.MarkDeleted;
    }

    // If the model is a junction table need to always delete
    if (model.mm) {
      preserveDeleted = false;
    }

    // For full sync remove all the records that are not found in this run
    if (syncConfig.sync_type === SyncType.Full) {
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
    } else if (SyncType.Incremental) {
      // For incremental we need to still clear junction table records
      // We will delete the records that are not updated in this run for updated parent records
      if (model.mm) {
        // first get records that are updated in this run 500 at a time
        const deletedParentIds = new Map<string, boolean>();

        let completedRun = false;
        let offset = 0;

        while (!completedRun) {
          const updatedRecords = await this.dataTableService.dataList(context, {
            baseId: model.base_id,
            modelId: model.id,
            query: {
              filterArr: [
                {
                  comparison_op: 'eq',
                  value: syncRunId,
                  logical_op: 'and',
                  fk_column_id: model.columns.find(
                    (c) => c.title === 'SyncRunId',
                  )?.id,
                },
              ],
              limit: 500,
              offset,
            },
          });

          for (const record of updatedRecords.list) {
            const parentId = record.RemoteIdParent;

            if (deletedParentIds.has(parentId)) {
              continue;
            }

            deletedParentIds.set(parentId, true);
          }

          if (
            updatedRecords.pageInfo.isLastPage ||
            updatedRecords.list.length === 0
          ) {
            completedRun = true;
          }

          offset += 500;
        }

        const deletedParentIdsArray = Array.from(deletedParentIds.keys());

        while (deletedParentIdsArray.length > 0) {
          const parentIds = deletedParentIdsArray.splice(0, 100);

          await this.bulkDataAliasService.bulkDataDeleteAll(context, {
            baseName: model.base_id,
            tableName: model.id,
            req,
            query: {
              filterArr: [
                {
                  comparison_op: 'in',
                  value: parentIds,
                  logical_op: 'and',
                  fk_column_id: model.columns.find(
                    (c) => c.title === 'RemoteIdParent',
                  )?.id,
                },
                {
                  comparison_op: 'neq',
                  value: syncRunId,
                  logical_op: 'and',
                  fk_column_id: model.columns.find(
                    (c) => c.title === 'SyncRunId',
                  )?.id,
                },
              ],
            },
          });
        }
      }
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
          mmParentColumn: Column;
          mmChildColumn: Column;
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

                  const mmParentColumn = mmTable.columns.find(
                    (c) => c.id === column.colOptions.fk_mm_parent_column_id,
                  );

                  if (!mmParentColumn) {
                    continue;
                  }

                  const mmChildColumn = mmTable.columns.find(
                    (c) => c.id === column.colOptions.fk_mm_child_column_id,
                  );

                  if (!mmChildColumn) {
                    continue;
                  }

                  linkFieldConfig = {
                    mmTable,
                    mmParentColumn,
                    mmChildColumn,
                  };

                  linkFieldsMap.set(
                    `${model.id}-${linkField}`,
                    linkFieldConfig,
                  );
                }

                const linkArray: {
                  RemoteId: string;
                  SyncConfigId: string;
                  RemoteSyncedAt: string;
                  SyncRunId: string;
                }[] = [];

                for (const record of data.links[linkField]) {
                  linkArray.push({
                    [linkFieldConfig.mmParentColumn.title]: record,
                    [linkFieldConfig.mmChildColumn.title]: data.recordId,
                    RemoteId: `${record}-${data.recordId}`,
                    SyncConfigId: syncConfig.id,
                    RemoteSyncedAt,
                    SyncRunId: syncRunId,
                  });
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

  async migrateSync(
    job: Job<{ context: NcContext; syncConfigId: string; req: NcRequest }>,
  ) {
    const { context, syncConfigId, req } = job.data;

    const syncConfig = await SyncConfig.get(context, syncConfigId);

    if (!syncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    const integration = await Integration.get(
      context,
      syncConfig.fk_integration_id,
    );
    const wrapper = await integration.getIntegrationWrapper<SyncIntegration>();
    const authIntegration = await Integration.get(
      context,
      integration.getConfig().authIntegrationId,
    );

    const authWrapper =
      await authIntegration.getIntegrationWrapper<AuthIntegration>();

    const auth = await authWrapper.authenticate();

    // Get new schema from integration
    const newSchema = await wrapper.getDestinationSchema(auth);

    // Get sync mappings for non-mm tables
    const syncMappings = await SyncMapping.list(context, {
      fk_sync_config_id: syncConfig.id,
    });

    for (const syncMapping of syncMappings) {
      const model = await Model.get(context, syncMapping.fk_model_id);
      if (!model || model.mm) continue;

      await model.getColumns(context);

      // Get existing readonly columns
      const existingColumns = model.columns.filter(
        (col) => !col.system && col.readonly && !syncSystemFieldsMap[col.title],
      );

      // Get new columns from schema
      const newColumns =
        newSchema[syncMapping.target_table as TARGET_TABLES]?.columns || [];

      // Find columns to add and remove
      const columnsToAdd = newColumns.filter(
        (newCol) =>
          !existingColumns.some(
            (existingCol) => existingCol.title === newCol.title,
          ),
      );

      const columnsToRemove = existingColumns.filter(
        (existingCol) =>
          !newColumns.some((newCol) => newCol.title === existingCol.title),
      );

      const columnsToRecreate = existingColumns.filter((existingCol) =>
        newColumns.some(
          (newCol) =>
            newCol.title === existingCol.title &&
            newCol.uidt !== existingCol.uidt &&
            // check if meta objects are equal
            JSON.stringify(newCol.meta ?? {}) !==
              JSON.stringify(existingCol.meta ?? {}),
        ),
      );

      columnsToRemove.push(...columnsToRecreate);
      columnsToAdd.push(...columnsToRecreate);

      // Remove columns
      for (const column of columnsToRemove) {
        await this.columnsService.columnDelete(context, {
          columnId: column.id,
          user: req.user,
          req,
        });
      }

      // Add new columns
      for (const column of columnsToAdd) {
        await this.columnsService.columnAdd(context, {
          tableId: model.id,
          column: {
            title: column.title,
            column_name: column.column_name || column.title,
            uidt: column.uidt,
            readonly: true,
            pv: column.pv,
          },
          user: req.user,
          req,
          apiVersion: NcApiVersion.V3,
        });
      }

      // If we have new columns, we need to update existing records
      if (columnsToAdd.length > 0) {
        let completed = false;
        let offset = 0;

        while (!completed) {
          // Get all existing records
          const existingRecords = await this.dataTableService.dataList(
            context,
            {
              baseId: model.base_id,
              modelId: model.id,
              query: {
                limit: 100,
                offset,
              },
            },
          );

          if (
            existingRecords.list.length === 0 ||
            existingRecords.pageInfo?.isLastPage
          ) {
            completed = true;
          }

          // Update each record with new column data
          for (const record of existingRecords.list) {
            if (record.RemoteRaw) {
              const rawData = JSON.parse(record.RemoteRaw);
              const formattedData = await wrapper.formatData(
                syncMapping.target_table as TARGET_TABLES,
                rawData,
              );

              // Only update the new columns
              const updateData = {};
              for (const column of columnsToAdd) {
                if (formattedData.data[column.title] !== undefined) {
                  updateData[column.title] = formattedData.data[column.title];
                }
              }

              if (Object.keys(updateData).length > 0) {
                await this.dataTableService.dataUpdate(context, {
                  baseId: model.base_id,
                  modelId: model.id,
                  body: {
                    Id: record.Id,
                    ...updateData,
                  },
                  cookie: req,
                  apiVersion: NcApiVersion.V3,
                  internalFlags: {
                    allowSystemColumn: true,
                  },
                });
              }
            }
          }

          offset += 100;
        }
      }
    }
  }
}
