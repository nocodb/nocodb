/* eslint-disable no-async-promise-executor */
import { isLinksOrLTAR, RelationTypes } from 'nocodb-sdk';
import sizeof from 'object-sizeof';
import EntityMap from './EntityMap';
import type { BulkDataAliasService } from '../../../../../services/bulk-data-alias.service';
import type { TablesService } from '../../../../../services/tables.service';
// @ts-ignore
import type { AirtableBase } from 'airtable/lib/airtable_base';
import type { TableType } from 'nocodb-sdk';

const BULK_DATA_BATCH_COUNT = 20; // check size for every 100 records
const BULK_DATA_BATCH_SIZE = 50 * 1024; // in bytes
const BULK_PARALLEL_PROCESS = 5;

interface AirtableImportContext {
  bulkDataService: BulkDataAliasService;
  tableService: TablesService;
}

async function readAllData({
  table,
  fields,
  atBase,
  logBasic = (_str) => {},
}: {
  table: { title?: string };
  fields?;
  atBase: AirtableBase;
  logBasic?: (string) => void;
  logDetailed?: (string) => void;
}): Promise<EntityMap> {
  return new Promise((resolve, reject) => {
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

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        async function done(err) {
          if (err) {
            console.error(err);
            return reject(err);
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
  sDB,
  logDetailed = (_str) => {},
  logBasic = (_str) => {},
  services,
}: {
  baseName: string;
  table: { title?: string; id?: string };
  fields?;
  atBase: AirtableBase;
  logBasic: (string) => void;
  logDetailed: (string) => void;
  nocoBaseDataProcessing_v2;
  sDB;
  services: AirtableImportContext;
}): Promise<EntityMap> {
  try {
    // returns EntityMap which allows us to stream data
    const records: EntityMap = await readAllData({
      table,
      atBase,
      logDetailed,
      logBasic,
    });

    await new Promise(async (resolve, reject) => {
      const readable = records.getStream();
      const allRecordsCount = await records.getCount();
      const promises = [];

      let tempData = [];
      let importedCount = 0;
      let tempCount = 0;

      // we keep track of active process to pause and resume the stream as we have async calls within the stream and we don't want to load all data in memory
      let activeProcess = 0;

      readable.on('data', async (record) => {
        promises.push(
          new Promise(async (resolve, reject) => {
            try {
              activeProcess++;
              if (activeProcess >= BULK_PARALLEL_PROCESS) readable.pause();

              const { id: rid, ...fields } = record;
              const r = await nocoBaseDataProcessing_v2(sDB, table, {
                id: rid,
                fields,
              });
              tempData.push(r);
              tempCount++;

              if (tempCount >= BULK_DATA_BATCH_COUNT) {
                if (sizeof(tempData) >= BULK_DATA_BATCH_SIZE) {
                  readable.pause();

                  let insertArray = tempData.splice(0, tempData.length);

                  await services.bulkDataService.bulkDataInsert({
                    baseName,
                    tableName: table.id,
                    body: insertArray,
                    cookie: {},
                    skip_hooks: true,
                  });

                  logBasic(
                    `:: Importing '${
                      table.title
                    }' data :: ${importedCount} - ${Math.min(
                      importedCount + insertArray.length,
                      allRecordsCount,
                    )}`,
                  );

                  importedCount += insertArray.length;
                  insertArray = [];

                  readable.resume();
                }
                tempCount = 0;
              }
              activeProcess--;
              if (activeProcess < BULK_PARALLEL_PROCESS) readable.resume();
              resolve(true);
            } catch (e) {
              reject(e);
            }
          }),
        );
      });
      readable.on('end', async () => {
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
          return reject(e);
        }
      });
    });

    return records;
  } catch (e) {
    console.log(e);
    return null;
  }
}

export async function importLTARData({
  table,
  fields,
  atBase,
  baseName,
  insertedAssocRef = {},
  logDetailed = (_str) => {},
  logBasic = (_str) => {},
  records,
  atNcAliasRef,
  ncLinkMappingTable,
  syncDB,
  services,
}: {
  baseName: string;
  table: { title?: string; id?: string };
  fields;
  atBase: AirtableBase;
  logDetailed: (string) => void;
  logBasic: (string) => void;
  insertedAssocRef: { [assocTableId: string]: boolean };
  records?: EntityMap;
  atNcAliasRef: {
    [ncTableId: string]: {
      [ncTitle: string]: string;
    };
  };
  ncLinkMappingTable: Record<string, Record<string, any>>[];
  syncDB;
  services: AirtableImportContext;
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
  // Iterate over all related M2M associative  table
  for await (const assocMeta of assocTableMetas) {
    let assocTableData = [];
    let importedCount = 0;
    let tempCount = 0;

    //  extract link data from records
    await new Promise((resolve, reject) => {
      const promises = [];
      const readable = allData.getStream();

      readable.on('data', async (record) => {
        promises.push(
          new Promise(async (resolve) => {
            try {
              const { id: _atId, ...rec } = record;

              // todo: use actual alias instead of sanitized
              assocTableData.push(
                ...(
                  rec?.[atNcAliasRef[table.id][assocMeta.colMeta.title]] || []
                ).map((id) => ({
                  [assocMeta.curCol.title]: record.id,
                  [assocMeta.refCol.title]: id,
                })),
              );
              tempCount++;

              if (tempCount >= BULK_DATA_BATCH_COUNT) {
                if (sizeof(assocTableData) >= BULK_DATA_BATCH_SIZE) {
                  readable.pause();

                  let insertArray = assocTableData.splice(
                    0,
                    assocTableData.length,
                  );

                  logBasic(
                    `:: Importing '${
                      table.title
                    }' LTAR data :: ${importedCount} - ${Math.min(
                      importedCount + insertArray.length,
                      insertArray.length,
                    )}`,
                  );

                  await services.bulkDataService.bulkDataInsert({
                    baseName,
                    tableName: assocMeta.modelMeta.id,
                    body: insertArray,
                    cookie: {},
                    skip_hooks: true,
                  });

                  importedCount += insertArray.length;
                  insertArray = [];

                  readable.resume();
                }
                tempCount = 0;
              }
              resolve(true);
            } catch (e) {
              reject(e);
            }
          }),
        );
      });
      readable.on('end', async () => {
        try {
          // ensure all chunks are processed
          await Promise.all(promises);

          // insert remaining data
          if (assocTableData.length >= 0) {
            logBasic(
              `:: Importing '${
                table.title
              }' LTAR data :: ${importedCount} - ${Math.min(
                importedCount + assocTableData.length,
                assocTableData.length,
              )}`,
            );

            await services.bulkDataService.bulkDataInsert({
              baseName,
              tableName: assocMeta.modelMeta.id,
              body: assocTableData,
              cookie: {},
              skip_hooks: true,
            });

            importedCount += assocTableData.length;
            assocTableData = [];
          }

          resolve(true);
        } catch (e) {
          reject(e);
        }
      });
    });

    nestedLinkCnt += importedCount;
  }
  return nestedLinkCnt;
}
