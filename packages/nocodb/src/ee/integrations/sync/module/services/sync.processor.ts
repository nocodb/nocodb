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

const BATCH_SIZE = 100;

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
      // we ignore pagination bc we are using the filterArrJson to get with ids
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
          skipHooks: true,
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
    mmColumn?: Column,
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
          internalFlags: {
            skipHooks: true,
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
          internalFlags: {
            skipHooks: true,
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
            ],
          },
        });
      }
    } else if (SyncType.Incremental) {
      // For incremental we need to still clear junction table records
      // We will delete the records that are not updated in this run for updated parent records
      if (model.mm && mmColumn) {
        // first get records that are updated in this run BATCH_SIZE at a time
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
              limit: BATCH_SIZE,
              offset,
            },
          });

          for (const record of updatedRecords.list) {
            const parentId = record[mmColumn.title];

            if (deletedParentIds.has(parentId)) {
              continue;
            }

            deletedParentIds.set(parentId, true);
          }

          if (updatedRecords.list.length < BATCH_SIZE) {
            completedRun = true;
          }

          offset += BATCH_SIZE;
        }

        if (deletedParentIds.size > 0) {
          const deletedParentIdsArray = Array.from(deletedParentIds.keys());

          while (deletedParentIdsArray.length > 0) {
            const parentIds = deletedParentIdsArray.splice(0, BATCH_SIZE);

            await this.bulkDataAliasService.bulkDataDeleteAll(context, {
              baseName: model.base_id,
              tableName: model.id,
              req,
              internalFlags: {
                skipHooks: true,
              },
              query: {
                filterArr: [
                  {
                    comparison_op: 'in',
                    value: parentIds,
                    logical_op: 'and',
                    fk_column_id: mmColumn.id,
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
  }

  async job(job: Job<SyncDataSyncModuleJobData>) {
    const {
      context,
      syncConfigId,
      trigger: _trigger,
      bulk = false,
      req,
    } = job.data;

    const logBasic = (message: string) => {
      this.jobsLogService.sendLog(job, {
        message,
      });
    };

    let parentSyncConfig: SyncConfig | null = null;

    const mainSyncConfig = await SyncConfig.get(context, syncConfigId);

    if (!mainSyncConfig) {
      NcError.genericNotFound('SyncConfig', syncConfigId);
    }

    if (
      mainSyncConfig.sync_job_id &&
      mainSyncConfig.sync_job_id !== `${job.id}`
    ) {
      NcError.badRequest('Another job is already running');
    }

    const syncConfigs = [mainSyncConfig];

    if (mainSyncConfig.fk_parent_sync_config_id) {
      parentSyncConfig = await SyncConfig.get(
        context,
        mainSyncConfig.fk_parent_sync_config_id,
      );

      if (!parentSyncConfig) {
        NcError.genericNotFound(
          'SyncConfig',
          mainSyncConfig.fk_parent_sync_config_id,
        );
      }
    } else {
      parentSyncConfig = mainSyncConfig;
    }

    if (bulk) {
      syncConfigs.push(...(mainSyncConfig.children || []));
    }

    const syncMappings = await SyncMapping.list(context, {
      fk_sync_config_id: parentSyncConfig.id,
    });

    let recordCounter = 0;

    // we specifically add mmChildColumn because child is this table for mm (kinda reverse)
    const modelSyncTargetMap = new Map<
      string,
      Model & {
        mmChildColumn?: Column;
      }
    >();
    const modelIdSyncTargetMap = new Map<string, string>();
    const targetTableIncrementalValues:
      | Record<string, string>
      | Record<string, Record<string, string>> = {};

    for (const syncMap of syncMappings) {
      const model = await Model.get(context, syncMap.fk_model_id);

      if (!model) {
        NcError.genericNotFound('Model', syncMap.fk_model_id);
      }

      await model.getColumns(context);

      modelSyncTargetMap.set(syncMap.target_table, model);
      modelIdSyncTargetMap.set(model.id, syncMap.target_table);
    }

    for (const syncConfig of syncConfigs) {
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
          await integration.getIntegrationWrapper<SyncIntegration>(logBasic);

        if (parentSyncConfig.sync_type === SyncType.Incremental) {
          for (const syncMap of syncMappings) {
            const model = modelSyncTargetMap.get(syncMap.target_table);

            if (!model) {
              NcError.genericNotFound('Model', syncMap.fk_model_id);
            }

            const namespaces = wrapper.getNamespaces();

            if (namespaces.length > 0) {
              for (const namespace of namespaces) {
                const lastRecord = await this.dataTableService.dataList(
                  context,
                  {
                    modelId: model.id,
                    query: {
                      limit: 1,
                      sort: `-${wrapper.getIncrementalKey(
                        syncMap.target_table as TARGET_TABLES,
                      )}`,
                      filterArrJson: JSON.stringify([
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
                          value: namespace,
                          logical_op: 'and',
                          fk_column_id: model.columns.find(
                            (c) => c.title === 'RemoteNamespace',
                          )?.id,
                        },
                      ]),
                    },
                  },
                );

                if (lastRecord.list.length > 0) {
                  if (!targetTableIncrementalValues[namespace]) {
                    targetTableIncrementalValues[namespace] = {};
                  }

                  targetTableIncrementalValues[namespace][
                    syncMap.target_table
                  ] =
                    lastRecord.list[0][
                      wrapper.getIncrementalKey(
                        syncMap.target_table as TARGET_TABLES,
                      )
                    ];
                }
              }
            } else {
              const lastRecord = await this.dataTableService.dataList(context, {
                modelId: model.id,
                query: {
                  limit: 1,
                  sort: `-${wrapper.getIncrementalKey(
                    syncMap.target_table as TARGET_TABLES,
                  )}`,
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
                },
              });

              if (lastRecord.list.length > 0) {
                targetTableIncrementalValues[syncMap.target_table] =
                  lastRecord.list[0][
                    wrapper.getIncrementalKey(
                      syncMap.target_table as TARGET_TABLES,
                    )
                  ];
              }
            }
          }
        }

        const dataStream = await wrapper.fetchData(auth, {
          targetTables: syncMappings.map(
            (m) => m.target_table as TARGET_TABLES,
          ),
          targetTableIncrementalValues,
        });

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

              const dataBuffer = dataBuffers.get(model.id);

              if (data.data) {
                Object.assign(data.data, {
                  RemoteId: data.recordId,
                  RemoteSyncedAt,
                  SyncConfigId: syncConfig.id,
                  SyncRunId: syncRunId,
                  RemoteDeleted: false,
                  SyncProvider: integration.getIntegrationMeta().title,
                });

                dataBuffer.push(data.data);
              }

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

                    const mmTable: Model & {
                      mmChildColumn?: Column;
                    } = await Model.get(
                      context,
                      column.colOptions.fk_mm_model_id,
                    );

                    if (!mmTable) {
                      continue;
                    }

                    await mmTable.getColumns(context);

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

                    mmTable.mmChildColumn = mmChildColumn;

                    modelSyncTargetMap.set(mmTable.id, mmTable);

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
                    SyncProvider: string;
                  }[] = [];

                  for (const record of data.links[linkField]) {
                    linkArray.push({
                      [linkFieldConfig.mmParentColumn.title]: record,
                      // mmChildColumn is the table we are adding from hence data.recordId
                      [linkFieldConfig.mmChildColumn.title]: data.recordId,
                      RemoteId: `${record}-${data.recordId}`,
                      SyncConfigId: syncConfig.id,
                      SyncProvider: integration.getIntegrationMeta().title,
                      RemoteSyncedAt,
                      SyncRunId: syncRunId,
                    });
                  }

                  if (!linkBuffers.has(linkFieldConfig.mmTable.id)) {
                    linkBuffers.set(linkFieldConfig.mmTable.id, []);
                  }

                  const linkBuffer = linkBuffers.get(
                    linkFieldConfig.mmTable.id,
                  );

                  linkBuffer.push(...linkArray);

                  if (linkBuffer.length >= BATCH_SIZE) {
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

              if (dataBuffer.length >= BATCH_SIZE) {
                dataStream.pause();

                const syncedCount = dataBuffer.length;
                recordCounter += syncedCount;

                await this.pushData(
                  context,
                  syncConfig,
                  model,
                  dataBuffer.splice(0),
                  req,
                );

                logBasic(
                  `[${integration.title} / ${model.title}]: Synced ${syncedCount} records`,
                );

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
                  const syncedCount = dataBuffer.length;
                  recordCounter += syncedCount;

                  await this.pushData(
                    context,
                    syncConfig,
                    model,
                    dataBuffer.splice(0),
                    req,
                  );

                  logBasic(
                    `[${integration.title} / ${model.title}]: Synced ${syncedCount} records`,
                  );
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
                    model.mmChildColumn,
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

              logBasic(
                `Sync Completed (${integration.title}): ${recordCounter} records synced`,
              );

              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });

        if (authWrapper?.destroy) {
          await authWrapper.destroy();
        }
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
          forceDeleteSystem: true,
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
                limit: BATCH_SIZE,
                offset,
              },
            },
          );

          if (existingRecords.list.length < BATCH_SIZE) {
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
                    skipHooks: true,
                  },
                });
              }
            }
          }

          offset += BATCH_SIZE;
        }
      }
    }

    if (authWrapper?.destroy) {
      await authWrapper.destroy();
    }
  }
}
