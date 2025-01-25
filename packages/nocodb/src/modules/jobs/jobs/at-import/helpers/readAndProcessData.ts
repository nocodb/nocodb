/* eslint-disable no-async-promise-executor */
import { Readable } from 'stream';
import { isLinksOrLTAR, RelationTypes } from 'nocodb-sdk';
import sizeof from 'object-sizeof';
import { Logger } from '@nestjs/common';
import PQueue from 'p-queue';
import type { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import type { TablesService } from '~/services/tables.service';
import type { AirtableBase } from 'airtable/lib/airtable_base';
import type { NcRequest, TableType } from 'nocodb-sdk';
import type { Source } from '~/models';
import type { NcContext } from '~/interface/config';

const logger = new Logger('at-import:readAndProcessData');

const BULK_DATA_BATCH_COUNT =
  +process.env.AT_IMPORT_BULK_DATA_BATCH_COUNT || 10; // check size for every N records
const BULK_DATA_BATCH_SIZE =
  +process.env.AT_IMPORT_BULK_DATA_BATCH_SIZE || 20 * 1024; // import N bytes at a time
const BULK_LINK_BATCH_COUNT =
  +process.env.AT_IMPORT_BULK_LINK_BATCH_COUNT || 500; // import N links at a time
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
  dataStream,
  counter,
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
              JSON.stringify({ _atId: record.id, ...record.fields }),
            );
            counter.streamingCounter++;
            recordCounter++;
            tempCounter++;
          }

          logBasic(
            `:: Reading '${table.title}' data :: ${Math.max(
              1,
              recordCounter - tempCounter,
            )} - ${recordCounter}`,
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
          dataStream.push(null);
          resolve(true);
        },
      );
  });
}

export async function importData(
  context: NcContext,
  {
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
    // link related props start
    insertedAssocRef = {},
    atNcAliasRef,
    ncLinkMappingTable,
    idMap,
    idCounter,
    req,
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
    idMap: Map<string, number>;
    idCounter: Record<string, number>;
    req: any;
  },
): Promise<{
  nestedLinkCount: number;
  importedCount: number;
}> {
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
      dataStream,
      counter,
      logBasic,
      logDetailed,
      logWarning,
    }).catch((e) => {
      logger.error(e);
      logWarning(`There were errors on reading '${table.title}' data :: ${e}`);
    });

    return new Promise(async (resolve) => {
      const queue = new PQueue({ concurrency: BULK_PARALLEL_PROCESS });

      const ltarPromise = importLTARData(context, {
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
        idMap,
        idCounter,
        logBasic,
        logDetailed,
        logWarning,
        req,
      }).catch((e) => {
        logger.error(e);
        logWarning(
          `There were errors on importing '${table.title}' LTAR data :: ${e}`,
        );
      });

      let tempData = [];
      let importedCount = 0;
      let nestedLinkCount = 0;
      let tempCount = 0;

      dataStream.on('data', async (record) => {
        counter.streamingCounter--;
        record = JSON.parse(record);
        queue.add(
          () =>
            new Promise(async (resolve) => {
              try {
                if (idCounter[table.id] === undefined) {
                  idCounter[table.id] = 1;
                }

                const { _atId: rid, ...fields } = record;
                if (!idMap.has(rid)) {
                  idMap.set(rid, idCounter[table.id]++);
                }
                const r = await nocoBaseDataProcessing_v2(syncDB, table, {
                  id: rid,
                  fields,
                });

                tempData.push({
                  ...r,
                  id: idMap.get(rid),
                });
                tempCount++;

                if (tempCount >= BULK_DATA_BATCH_COUNT) {
                  if (sizeof(tempData) >= BULK_DATA_BATCH_SIZE) {
                    let insertArray = tempData.splice(0, tempData.length);

                    await services.bulkDataService.bulkDataInsert(context, {
                      baseName,
                      tableName: table.id,
                      body: insertArray,
                      cookie: req,
                      skip_hooks: true,
                      foreign_key_checks: !!source.isMeta(),
                      allowSystemColumn: true,
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
      dataStream.on('end', async () => {
        try {
          // ensure all chunks are processed
          await queue.onIdle();

          // insert remaining data
          if (tempData.length > 0) {
            await services.bulkDataService.bulkDataInsert(context, {
              baseName,
              tableName: table.id,
              body: tempData,
              cookie: req,
              skip_hooks: true,
              foreign_key_checks: !!source.isMeta(),
              allowSystemColumn: true,
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

export async function importLTARData(
  context: NcContext,
  {
    table,
    baseName,
    insertedAssocRef = {},
    dataStream,
    atNcAliasRef,
    ncLinkMappingTable,
    syncDB,
    source,
    services,
    queue,
    idMap,
    idCounter,
    logBasic = (_str) => {},
    logWarning = (_str) => {},
    req,
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
    source: Source;
    services: AirtableImportContext;
    queue: PQueue;
    idMap: Map<string, number>;
    idCounter: Record<string, number>;
    logBasic: (string) => void;
    logDetailed: (string) => void;
    logWarning: (string) => void;
    req: NcRequest;
  },
): Promise<number> {
  const assocTableMetas: Array<{
    modelMeta: { id?: string; title?: string };
    colMeta: { title?: string; colOptions?: { fk_related_model_id?: string } };
    curCol: { title?: string };
    refCol: { title?: string };
  }> = [];

  const modelMeta: any =
    await services.tableService.getTableWithAccessibleViews(context, {
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
      (await services.tableService.getTableWithAccessibleViews(context, {
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
                if (
                  idCounter[
                    assocMeta.colMeta.colOptions.fk_related_model_id
                  ] === undefined
                ) {
                  idCounter[
                    assocMeta.colMeta.colOptions.fk_related_model_id
                  ] = 1;
                }

                if (idCounter[table.id] === undefined) {
                  idCounter[table.id] = 1;
                }

                const { _atId, ...rec } = record;

                if (!idMap.has(_atId)) {
                  rec.id = idMap.set(_atId, idCounter[table.id]++);
                }

                // todo: use actual alias instead of sanitized
                const links =
                  rec?.[atNcAliasRef[table.id][assocMeta.colMeta.title]] || [];
                for (const id of links) {
                  if (!idMap.has(id)) {
                    idMap.set(
                      id,
                      idCounter[
                        assocMeta.colMeta.colOptions.fk_related_model_id
                      ]++,
                    );
                  }

                  assocTableData[assocMeta.modelMeta.id].push({
                    [assocMeta.curCol.title]: idMap.get(_atId),
                    [assocMeta.refCol.title]: idMap.get(id),
                  });

                  // links can be [] & hence assocTableDta[assocMeta.modelMeta.id] can be [].
                  if (
                    assocTableData[assocMeta.modelMeta.id]?.length >=
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

                    await services.bulkDataService.bulkDataInsert(context, {
                      baseName,
                      tableName: assocMeta.modelMeta.id,
                      body: insertArray,
                      cookie: req,
                      skip_hooks: true,
                      foreign_key_checks: !!source.isMeta(),
                      allowSystemColumn: true,
                    });

                    insertArray = [];
                  }
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

        for (const assocMeta of assocTableMetas) {
          // insert remaining data
          if (assocTableData[assocMeta.modelMeta.id]?.length >= 0) {
            logBasic(
              `:: Importing '${table.title}' LTAR data :: ${importedCount} - ${
                importedCount + assocTableData[assocMeta.modelMeta.id].length
              }`,
            );

            await services.bulkDataService.bulkDataInsert(context, {
              baseName,
              tableName: assocMeta.modelMeta.id,
              body: assocTableData[assocMeta.modelMeta.id],
              cookie: req,
              skip_hooks: true,
              foreign_key_checks: !!source.isMeta(),
              allowSystemColumn: true,
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
