/* eslint-disable no-async-promise-executor */
import { isLinksOrLTAR, RelationTypes } from 'nocodb-sdk';
import sizeof from 'object-sizeof';
import { Logger } from '@nestjs/common';
import PQueue from 'p-queue';
import type { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import type { TablesService } from '~/services/tables.service';
import type { AirtableBase } from 'airtable/lib/airtable_base';
import type { TableType } from 'nocodb-sdk';
import type { Source } from '~/models';

const logger = new Logger('BaseModelSqlv2');

const BULK_DATA_BATCH_COUNT =
  +process.env.AT_IMPORT_BULK_DATA_BATCH_COUNT || 10; // check size for every N records
const BULK_DATA_BATCH_SIZE =
  +process.env.AT_IMPORT_BULK_DATA_BATCH_SIZE || 20 * 1024; // import N bytes at a time
const BULK_LINK_BATCH_COUNT =
  +process.env.AT_IMPORT_BULK_LINK_BATCH_COUNT || 200; // import N links at a time
const BULK_PARALLEL_PROCESS = +process.env.AT_IMPORT_BULK_PARALLEL_PROCESS || 2; // process N records at a time
const STREAM_BUFFER_LIMIT = +process.env.AT_IMPORT_STREAM_BUFFER_LIMIT || 100; // pause reading if we have more than N records to avoid backpressure
const QUEUE_BUFFER_LIMIT = +process.env.AT_IMPORT_QUEUE_BUFFER_LIMIT || 20; // pause streaming if we have more than N records in the queue

interface AirtableImportContext {
  bulkDataService: BulkDataAliasService;
  tableService: TablesService;
}

async function readAllData({
  table,
  fields,
  atBase,
  logBasic = (_str) => {},
  logWarning = (_str) => {},
}: {
  table: { title?: string };
  fields?;
  atBase: AirtableBase;
  dataStream: Readable;
  counter?: { streamingCounter: number };
  logBasic?: (string) => void;
  logDetailed?: (string) => void;
  logWarning?: (string) => void;
}): Promise<EntityMap> {
  return new Promise((resolve) => {
    let data = null;

    const selectParams: any = {
      pageSize: 100,
    };

    if (fields) selectParams.fields = fields;

    atBase(table.title)
      .select(selectParams)
      .eachPage(
        async function page(records, fetchNextPage) {
          if (!data) {
            /*
              EntityMap is a sqlite3 table dynamically populated based on json data provided
              It is used to store data temporarily and then stream it in bulk to import

              This is done to avoid memory issues - heap out of memory - while importing large data
            */
            data = new EntityMap();
            await data.init();
          }

          for await (const record of records) {
            await data.addRow({ id: record.id, ...record.fields });
          }

          const tmpLength = await data.getCount();

          logBasic(
            `:: Reading '${table.title}' data :: ${Math.max(
              1,
              tmpLength - records.length,
            )} - ${tmpLength}`,
          );

          // pause reading if we have more than STREAM_BUFFER_LIMIT to avoid backpressure
          if (counter && counter.streamingCounter >= STREAM_BUFFER_LIMIT) {
            await new Promise((resolve) => {
              const interval = setInterval(() => {
                if (counter.streamingCounter < STREAM_BUFFER_LIMIT / 2) {
                  clearInterval(interval);
                  resolve(true);
                }
              }, 100);
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
          resolve(data);
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
  source,
  logBasic = (_str) => {},
  logDetailed = (_str) => {},
  logWarning = (_str) => {},
  services,
}: {
  baseName: string;
  table: { title?: string; id?: string };
  fields?;
  atBase: AirtableBase;
  source: Source;
  logBasic: (string) => void;
  logDetailed: (string) => void;
  logWarning: (string) => void;
  nocoBaseDataProcessing_v2;
  sDB;
  services: AirtableImportContext;
}): Promise<EntityMap> {
  try {
    const counter = {
      streamingCounter: 0,
    };

    const dataStream = new Readable({
      read() {},
    });

    dataStream.pause();

    readAllData({
      table,
      atBase,
      logDetailed,
      logBasic,
    });

    return new Promise(async (resolve) => {
      const queue = new PQueue({ concurrency: BULK_PARALLEL_PROCESS });

      const ltarPromise = importLTARData({
        table,
        baseName,
        insertedAssocRef,
        dataStream,
        atNcAliasRef,
        ncLinkMappingTable,
        syncDB,
        source,
        services,
        queue,
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
      let tempCount = 0;

      dataStream.on('data', async (record) => {
        counter.streamingCounter--;
        record = JSON.parse(record);
        queue.add(
          () =>
            new Promise(async (resolve) => {
              try {
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
                      foreign_key_checks: !!source.isMeta(),
                    });

                    logBasic(
                      `:: Importing '${
                        table.title
                      }' data :: ${importedCount} - ${
                        importedCount + insertArray.length
                      }`,
                    );

                    importedCount += insertArray.length;
                    insertArray = [];
                  }
                  tempCount = 0;
                }

                if (queue.size < QUEUE_BUFFER_LIMIT / 2) dataStream.resume();

                resolve(true);
              } catch (e) {
                logger.error(e);
                logWarning(
                  `There were errors on importing '${table.title}' data :: ${e}`,
                );
                if (queue.size < QUEUE_BUFFER_LIMIT / 2) dataStream.resume();
                resolve(true);
              }
            }),
        );

        if (queue.size >= QUEUE_BUFFER_LIMIT) dataStream.pause();
      });
      readable.on('end', async () => {
        try {
          // ensure all chunks are processed
          await queue.onIdle();

          // insert remaining data
          if (tempData.length > 0) {
            await services.bulkDataService.bulkDataInsert({
              baseName,
              tableName: table.id,
              body: tempData,
              cookie: {},
              skip_hooks: true,
              foreign_key_checks: !!source.isMeta(),
            });

            logBasic(
              `:: Importing '${
                table.title
              }' data :: ${importedCount} - ${Math.min(
                importedCount + tempData.length,
                allRecordsCount,
              )}`,
            );
            importedCount += tempData.length;
            tempData = [];
          }
          resolve(true);
        } catch (e) {
          logger.error(e);
          logWarning(
            `There were errors on importing '${table.title}' data :: ${e}`,
          );
          resolve(true);
        }
      });
    });

    return records;
  } catch (e) {
    throw e;
  }
}

export async function importLTARData({
  table,
  fields,
  atBase,
  baseName,
  insertedAssocRef = {},
  records,
  atNcAliasRef,
  ncLinkMappingTable,
  syncDB,
  source,
  services,
  queue,
  logBasic = (_str) => {},
  logDetailed = (_str) => {},
  logWarning = (_str) => {},
}: {
  baseName: string;
  table: { title?: string; id?: string };
  fields;
  atBase: AirtableBase;
  insertedAssocRef: { [assocTableId: string]: boolean };
  records?: EntityMap;
  atNcAliasRef: {
    [ncTableId: string]: {
      [ncTitle: string]: string;
    };
  };
  ncLinkMappingTable: Record<string, Record<string, any>>[];
  syncDB;
  source: Source;
  services: AirtableImportContext;
  queue: PQueue;
  logBasic: (string) => void;
  logDetailed: (string) => void;
  logWarning: (string) => void;
}) {
  const assocTableMetas: Array<{
    modelMeta: { id?: string; title?: string };
    colMeta: { title?: string };
    curCol: { title?: string };
    refCol: { title?: string };
  }> = [];
  const allData: EntityMap =
    records ||
    (await readAllData({
      table,
      fields,
      atBase,
      logDetailed,
      logBasic,
    }));

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
    dataStream.on('data', async (record) => {
      record = JSON.parse(record);
      // Iterate over all related M2M associative  table
      for (const assocMeta of assocTableMetas) {
        if (!assocTableData[assocMeta.modelMeta.id]) {
          assocTableData[assocMeta.modelMeta.id] = [];
        }
        queue.add(
          () =>
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
                  let insertArray = assocTableData[
                    assocMeta.modelMeta.id
                  ].splice(0, assocTableData[assocMeta.modelMeta.id].length);

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
                    foreign_key_checks: !!source.isMeta(),
                  });

                  insertArray = [];
                }

                if (queue.size < QUEUE_BUFFER_LIMIT / 2) dataStream.resume();
                resolve(true);
              } catch (e) {
                logger.error(e);
                logWarning(
                  `There were errors on importing '${table.title}' LTAR data :: ${e}`,
                );
                if (queue.size < QUEUE_BUFFER_LIMIT / 2) dataStream.resume();
                resolve(true);
              }
            }),
        );
      }

      if (queue.size >= QUEUE_BUFFER_LIMIT) dataStream.pause();
    });
    dataStream.on('end', async () => {
      try {
        // ensure all chunks are processed
        await queue.onIdle();

          // insert remaining data
          if (assocTableData.length >= 0) {
            logBasic(
              `:: Importing '${table.title}' LTAR data :: ${importedCount} - ${
                importedCount + assocTableData.length
              }`,
            );

            await services.bulkDataService.bulkDataInsert({
              baseName,
              tableName: assocMeta.modelMeta.id,
              body: assocTableData,
              cookie: {},
              skip_hooks: true,
              foreign_key_checks: !!source.isMeta(),
            });

            importedCount += assocTableData.length;
            assocTableData = [];
          }

          nestedLinkCnt += importedCount;

          resolve(true);
        } catch (e) {
          logger.error(e);
          logWarning(
            `There were errors on importing '${table.title}' LTAR data :: ${e}`,
          );
          resolve(true);
        }
      });
    });
  }
  return nestedLinkCnt;
}
