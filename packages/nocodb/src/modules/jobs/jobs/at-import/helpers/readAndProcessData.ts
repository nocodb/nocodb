/* eslint-disable no-async-promise-executor */
import { Readable } from 'stream';
import { isLinksOrLTAR, RelationTypes } from 'nocodb-sdk';
import sizeof from 'object-sizeof';
import { Logger } from '@nestjs/common';
import type { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import type { TablesService } from '~/services/tables.service';
// @ts-ignore
import type { AirtableBase } from 'airtable/lib/airtable_base';
import type { TableType } from 'nocodb-sdk';

const logger = new Logger('BaseModelSqlv2');

const BULK_DATA_BATCH_COUNT = 40; // check size for every 40 records
const BULK_DATA_BATCH_SIZE = 50 * 1024; // in bytes
const BULK_LINK_BATCH_COUNT = 1000; // process 1000 records at a time
const BULK_PARALLEL_PROCESS = 10;

interface AirtableImportContext {
  bulkDataService: BulkDataAliasService;
  tableService: TablesService;
}

async function readAllData({
  table,
  fields,
  atBase,
  dataStream,
  activeProcess,
  logBasic = (_str) => {},
  logWarning = (_str) => {},
}: {
  table: { title?: string };
  fields?;
  atBase: AirtableBase;
  dataStream: Readable;
  activeProcess?: { count: number };
  logBasic?: (string) => void;
  logDetailed?: (string) => void;
  logWarning?: (string) => void;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const selectParams: any = {
      pageSize: 100,
    };

    if (fields) selectParams.fields = fields;

    let recordCounter = 0;

    atBase(table.title)
      .select(selectParams)
      .eachPage(
        async function page(records, fetchNextPage) {
          let tempCounter = 0;
          for (const record of records) {
            dataStream.push(
              JSON.stringify({ id: record.id, ...record.fields }),
            );
            recordCounter++;
            tempCounter++;
          }

          logBasic(
            `:: Reading '${table.title}' data :: ${Math.max(
              1,
              recordCounter - tempCounter,
            )} - ${recordCounter}`,
          );

          // pause reading if we have more than BULK_PARALLEL_PROCESS parallel process to avoid backpressure
          if (activeProcess && activeProcess.count >= BULK_PARALLEL_PROCESS) {
            await new Promise((resolve) => {
              const interval = setInterval(() => {
                if (activeProcess.count < BULK_PARALLEL_PROCESS) {
                  clearInterval(interval);
                  resolve(true);
                }
              }, 200);
            });
          }

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        async function done(err) {
          if (err) {
            logger.error(err);
            logWarning(
              `There were errors on reading '${table.title}' data :: ${err}`,
            );
          }
          dataStream.push(null);
          resolve(true);
        },
      );
  });
}

export async function importData({
  baseName,
  table,
  atBase,
  nocoBaseDataProcessing_v2,
  syncDB,
  logBasic = (_str) => {},
  logDetailed = (_str) => {},
  logWarning = (_str) => {},
  services,
  // link related props start
  insertedAssocRef = {},
  atNcAliasRef,
  ncLinkMappingTable,
}: {
  baseName: string;
  table: { title?: string; id?: string };
  fields?;
  atBase: AirtableBase;
  logBasic: (string) => void;
  logDetailed: (string) => void;
  logWarning: (string) => void;
  nocoBaseDataProcessing_v2;
  // link related props start
  insertedAssocRef: { [assocTableId: string]: boolean };
  atNcAliasRef: {
    [ncTableId: string]: {
      [ncTitle: string]: string;
    };
  };
  ncLinkMappingTable: Record<string, Record<string, any>>[];
  // link related props end
  syncDB;
  services: AirtableImportContext;
}): Promise<{
  nestedLinkCount: number;
  importedCount: number;
}> {
  try {
    // we keep track of active process to pause and resume the stream as we have async calls within the stream and we don't want to load all data in memory
    const activeProcess = {
      count: 0,
    };

    const dataStream = new Readable({
      read() {},
    });

    dataStream.pause();

    readAllData({
      table,
      atBase,
      dataStream,
      activeProcess,
      logBasic,
      logDetailed,
      logWarning,
    }).catch((e) => {
      logWarning(`There were errors on reading '${table.title}' data :: ${e}`);
    });

    return new Promise(async (resolve) => {
      const promises = [];

      const ltarPromise = importLTARData({
        table,
        baseName,
        insertedAssocRef,
        dataStream,
        atNcAliasRef,
        ncLinkMappingTable,
        syncDB,
        services,
        logBasic,
        logDetailed,
        logWarning,
      }).catch((e) => {
        logWarning(
          `There were errors on importing '${table.title}' LTAR data :: ${e}`,
        );
      });

      let tempData = [];
      let importedCount = 0;
      let nestedLinkCount = 0;
      let tempCount = 0;

      dataStream.on('data', async (record) => {
        record = JSON.parse(record);
        promises.push(
          new Promise(async (resolve) => {
            try {
              activeProcess.count++;
              if (activeProcess.count >= BULK_PARALLEL_PROCESS)
                dataStream.pause();

              const { id: rid, ...fields } = record;
              const r = await nocoBaseDataProcessing_v2(syncDB, table, {
                id: rid,
                fields,
              });
              tempData.push(r);
              tempCount++;

              if (tempCount >= BULK_DATA_BATCH_COUNT) {
                if (sizeof(tempData) >= BULK_DATA_BATCH_SIZE) {
                  let insertArray = tempData.splice(0, tempData.length);

                  await services.bulkDataService.bulkDataInsert({
                    baseName,
                    tableName: table.id,
                    body: insertArray,
                    cookie: {},
                    skip_hooks: true,
                  });

                  logBasic(
                    `:: Importing '${table.title}' data :: ${importedCount} - ${
                      importedCount + insertArray.length
                    }`,
                  );

                  importedCount += insertArray.length;
                  insertArray = [];
                }
                tempCount = 0;
              }
              activeProcess.count--;
              if (activeProcess.count < BULK_PARALLEL_PROCESS)
                dataStream.resume();
              resolve(true);
            } catch (e) {
              logger.error(e);
              logWarning(
                `There were errors on importing '${table.title}' data :: ${e}`,
              );
              activeProcess.count--;
              dataStream.resume();
              resolve(true);
            }
          }),
        );
      });
      dataStream.on('end', async () => {
        try {
          // ensure all chunks are processed
          await Promise.all(promises);

          // insert remaining data
          if (tempData.length > 0) {
            await services.bulkDataService.bulkDataInsert({
              baseName,
              tableName: table.id,
              body: tempData,
              cookie: {},
              skip_hooks: true,
            });

            logBasic(
              `:: Importing '${table.title}' data :: ${importedCount} - ${
                importedCount + tempData.length
              }`,
            );
            importedCount += tempData.length;
            tempData = [];
          }

          nestedLinkCount = (await ltarPromise) as number;

          resolve({
            importedCount,
            nestedLinkCount,
          });
        } catch (e) {
          logger.error(e);
          logWarning(
            `There were errors on importing '${table.title}' data :: ${e}`,
          );
          resolve({
            importedCount,
            nestedLinkCount,
          });
        }
      });
    });
  } catch (e) {
    throw e;
  }
}

export async function importLTARData({
  table,
  baseName,
  insertedAssocRef = {},
  dataStream,
  atNcAliasRef,
  ncLinkMappingTable,
  syncDB,
  services,
  logBasic = (_str) => {},
  logWarning = (_str) => {},
}: {
  baseName: string;
  table: { title?: string; id?: string };
  insertedAssocRef: { [assocTableId: string]: boolean };
  dataStream?: Readable;
  atNcAliasRef: {
    [ncTableId: string]: {
      [ncTitle: string]: string;
    };
  };
  ncLinkMappingTable: Record<string, Record<string, any>>[];
  syncDB;
  services: AirtableImportContext;
  logBasic: (string) => void;
  logDetailed: (string) => void;
  logWarning: (string) => void;
}): Promise<number> {
  const assocTableMetas: Array<{
    modelMeta: { id?: string; title?: string };
    colMeta: { title?: string };
    curCol: { title?: string };
    refCol: { title?: string };
  }> = [];

  const modelMeta: any =
    await services.tableService.getTableWithAccessibleViews({
      tableId: table.id,
      user: syncDB.user,
    });

  for (const colMeta of modelMeta.columns) {
    // skip columns which are not LTAR and Many to many
    if (
      !isLinksOrLTAR(colMeta.uidt) ||
      colMeta.colOptions.type !== RelationTypes.MANY_TO_MANY
    ) {
      continue;
    }

    // skip if already inserted
    if (colMeta.colOptions.fk_mm_model_id in insertedAssocRef) continue;

    // self links: skip if the column under consideration is the add-on column NocoDB creates
    if (ncLinkMappingTable.every((a) => a.nc.title !== colMeta.title)) continue;

    // mark as inserted
    insertedAssocRef[colMeta.colOptions.fk_mm_model_id] = true;

    const assocModelMeta: TableType =
      (await services.tableService.getTableWithAccessibleViews({
        tableId: colMeta.colOptions.fk_mm_model_id,
        user: syncDB.user,
      })) as any;

    // extract associative table and columns meta
    assocTableMetas.push({
      modelMeta: assocModelMeta,
      colMeta,
      curCol: assocModelMeta.columns.find(
        (c) => c.id === colMeta.colOptions.fk_mm_child_column_id,
      ),
      refCol: assocModelMeta.columns.find(
        (c) => c.id === colMeta.colOptions.fk_mm_parent_column_id,
      ),
    });
  }

  let nestedLinkCnt = 0;
  let importedCount = 0;
  const assocTableData = {};
  //  extract link data from records
  return new Promise((resolve, reject) => {
    const promises = [];

    dataStream.on('data', async (record) => {
      record = JSON.parse(record);
      // Iterate over all related M2M associative  table
      for (const assocMeta of assocTableMetas) {
        if (!assocTableData[assocMeta.modelMeta.id]) {
          assocTableData[assocMeta.modelMeta.id] = [];
        }
        promises.push(
          new Promise(async (resolve) => {
            try {
              const { id: _atId, ...rec } = record;

              // todo: use actual alias instead of sanitized
              assocTableData[assocMeta.modelMeta.id].push(
                ...(
                  rec?.[atNcAliasRef[table.id][assocMeta.colMeta.title]] || []
                ).map((id) => ({
                  [assocMeta.curCol.title]: record.id,
                  [assocMeta.refCol.title]: id,
                })),
              );

              if (
                assocTableData[assocMeta.modelMeta.id].length >=
                BULK_LINK_BATCH_COUNT
              ) {
                let insertArray = assocTableData[assocMeta.modelMeta.id].splice(
                  0,
                  assocTableData[assocMeta.modelMeta.id].length,
                );

                const lastImportedCount = importedCount;
                importedCount += insertArray.length;

                logBasic(
                  `:: Importing '${
                    table.title
                  }' LTAR data :: ${lastImportedCount} - ${
                    lastImportedCount + insertArray.length
                  }`,
                );

                await services.bulkDataService.bulkDataInsert({
                  baseName,
                  tableName: assocMeta.modelMeta.id,
                  body: insertArray,
                  cookie: {},
                  skip_hooks: true,
                });

                insertArray = [];
              }
              resolve(true);
            } catch (e) {
              logger.error(e);
              logWarning(
                `There were errors on importing '${table.title}' LTAR data :: ${e}`,
              );
              resolve(true);
            }
          }),
        );
      }
    });
    dataStream.on('end', async () => {
      try {
        // ensure all chunks are processed
        await Promise.all(promises);

        for (const assocMeta of assocTableMetas) {
          // insert remaining data
          if (assocTableData[assocMeta.modelMeta.id].length >= 0) {
            logBasic(
              `:: Importing '${table.title}' LTAR data :: ${importedCount} - ${
                importedCount + assocTableData[assocMeta.modelMeta.id].length
              }`,
            );

            await services.bulkDataService.bulkDataInsert({
              baseName,
              tableName: assocMeta.modelMeta.id,
              body: assocTableData[assocMeta.modelMeta.id],
              cookie: {},
              skip_hooks: true,
            });

            importedCount += assocTableData[assocMeta.modelMeta.id].length;
            assocTableData[assocMeta.modelMeta.id] = [];
          }
        }

        nestedLinkCnt += importedCount;

        resolve(nestedLinkCnt);
      } catch (e) {
        reject(e);
      }
    });

    // resume the stream after all listeners are attached
    dataStream.resume();
  });
}
