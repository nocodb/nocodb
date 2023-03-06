import { AirtableBase } from 'airtable/lib/airtable_base';
import { Api, RelationTypes, TableType, UITypes } from 'nocodb-sdk';
import EntityMap from './EntityMap';

const BULK_DATA_BATCH_SIZE = 500;
const ASSOC_BULK_DATA_BATCH_SIZE = 1000;
const BULK_PARALLEL_PROCESS = 5;

async function readAllData({
  table,
  fields,
  base,
  logBasic = (_str) => {},
}: {
  table: { title?: string };
  fields?;
  base: AirtableBase;
  logBasic?: (string) => void;
  logDetailed?: (string) => void;
}): Promise<EntityMap> {
  return new Promise((resolve, reject) => {
    let data = null;

    const selectParams: any = {
      pageSize: 100,
    };

    if (fields) selectParams.fields = fields;

    base(table.title)
      .select(selectParams)
      .eachPage(
        async function page(records, fetchNextPage) {
          if (!data) {
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
              tmpLength - records.length
            )} - ${tmpLength}`
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
        }
      );
  });
}

export async function importData({
  projectName,
  table,
  base,
  api,
  nocoBaseDataProcessing_v2,
  sDB,
  logDetailed = (_str) => {},
  logBasic = (_str) => {},
}: {
  projectName: string;
  table: { title?: string; id?: string };
  fields?;
  base: AirtableBase;
  logBasic: (string) => void;
  logDetailed: (string) => void;
  api: Api<any>;
  nocoBaseDataProcessing_v2;
  sDB;
}): Promise<EntityMap> {
  try {
    // @ts-ignore
    const records = await readAllData({
      table,
      base,
      logDetailed,
      logBasic,
    });

    await new Promise(async (resolve) => {
      const readable = records.getStream();
      const allRecordsCount = await records.getCount();
      const promises = [];
      let tempData = [];
      let importedCount = 0;
      let activeProcess = 0;
      readable.on('data', async (record) => {
        promises.push(
          new Promise(async (resolve) => {
            activeProcess++;
            if (activeProcess >= BULK_PARALLEL_PROCESS) readable.pause();
            const { id: rid, ...fields } = record;
            const r = await nocoBaseDataProcessing_v2(sDB, table, {
              id: rid,
              fields,
            });
            tempData.push(r);

            if (tempData.length >= BULK_DATA_BATCH_SIZE) {
              let insertArray = tempData.splice(0, tempData.length);
              await api.dbTableRow.bulkCreate(
                'nc',
                projectName,
                table.id,
                insertArray
              );
              logBasic(
                `:: Importing '${
                  table.title
                }' data :: ${importedCount} - ${Math.min(
                  importedCount + BULK_DATA_BATCH_SIZE,
                  allRecordsCount
                )}`
              );
              importedCount += insertArray.length;
              insertArray = [];
            }
            activeProcess--;
            if (activeProcess < BULK_PARALLEL_PROCESS) readable.resume();
            resolve(true);
          })
        );
      });
      readable.on('end', async () => {
        await Promise.all(promises);
        if (tempData.length > 0) {
          await api.dbTableRow.bulkCreate(
            'nc',
            projectName,
            table.id,
            tempData
          );
          logBasic(
            `:: Importing '${
              table.title
            }' data :: ${importedCount} - ${Math.min(
              importedCount + BULK_DATA_BATCH_SIZE,
              allRecordsCount
            )}`
          );
          importedCount += tempData.length;
          tempData = [];
        }
        resolve(true);
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
  base,
  api,
  projectName,
  insertedAssocRef = {},
  logDetailed = (_str) => {},
  logBasic = (_str) => {},
  records,
  atNcAliasRef,
  ncLinkMappingTable,
}: {
  projectName: string;
  table: { title?: string; id?: string };
  fields;
  base: AirtableBase;
  logDetailed: (string) => void;
  logBasic: (string) => void;
  api: Api<any>;
  insertedAssocRef: { [assocTableId: string]: boolean };
  records?: EntityMap;
  atNcAliasRef: {
    [ncTableId: string]: {
      [ncTitle: string]: string;
    };
  };
  ncLinkMappingTable: Record<string, Record<string, any>>[];
}) {
  const assocTableMetas: Array<{
    modelMeta: { id?: string; title?: string };
    colMeta: { title?: string };
    curCol: { title?: string };
    refCol: { title?: string };
  }> = [];
  const allData =
    records ||
    (await readAllData({
      table,
      fields,
      base,
      logDetailed,
      logBasic,
    }));

  const modelMeta: any = await api.dbTable.read(table.id);

  for (const colMeta of modelMeta.columns) {
    // skip columns which are not LTAR and Many to many
    if (
      colMeta.uidt !== UITypes.LinkToAnotherRecord ||
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

    const assocModelMeta: TableType = (await api.dbTable.read(
      colMeta.colOptions.fk_mm_model_id
    )) as any;

    // extract associative table and columns meta
    assocTableMetas.push({
      modelMeta: assocModelMeta,
      colMeta,
      curCol: assocModelMeta.columns.find(
        (c) => c.id === colMeta.colOptions.fk_mm_child_column_id
      ),
      refCol: assocModelMeta.columns.find(
        (c) => c.id === colMeta.colOptions.fk_mm_parent_column_id
      ),
    });
  }

  let nestedLinkCnt = 0;
  // Iterate over all related M2M associative  table
  for await (const assocMeta of assocTableMetas) {
    let assocTableData = [];
    let importedCount = 0;

    //  extract insert data from records
    await new Promise((resolve) => {
      const promises = [];
      const readable = allData.getStream();
      let activeProcess = 0;
      readable.on('data', async (record) => {
        promises.push(
          new Promise(async (resolve) => {
            activeProcess++;
            if (activeProcess >= BULK_PARALLEL_PROCESS) readable.pause();
            const { id: _atId, ...rec } = record;

            // todo: use actual alias instead of sanitized
            assocTableData.push(
              ...(
                rec?.[atNcAliasRef[table.id][assocMeta.colMeta.title]] || []
              ).map((id) => ({
                [assocMeta.curCol.title]: record.id,
                [assocMeta.refCol.title]: id,
              }))
            );

            if (assocTableData.length >= ASSOC_BULK_DATA_BATCH_SIZE) {
              let insertArray = assocTableData.splice(0, assocTableData.length);
              logBasic(
                `:: Importing '${
                  table.title
                }' LTAR data :: ${importedCount} - ${Math.min(
                  importedCount + ASSOC_BULK_DATA_BATCH_SIZE,
                  insertArray.length
                )}`
              );

              await api.dbTableRow.bulkCreate(
                'nc',
                projectName,
                assocMeta.modelMeta.id,
                insertArray
              );

              importedCount += insertArray.length;
              insertArray = [];
            }
            activeProcess--;
            if (activeProcess < BULK_PARALLEL_PROCESS) readable.resume();
            resolve(true);
          })
        );
      });
      readable.on('end', async () => {
        await Promise.all(promises);
        if (assocTableData.length >= 0) {
          logBasic(
            `:: Importing '${
              table.title
            }' LTAR data :: ${importedCount} - ${Math.min(
              importedCount + ASSOC_BULK_DATA_BATCH_SIZE,
              assocTableData.length
            )}`
          );

          await api.dbTableRow.bulkCreate(
            'nc',
            projectName,
            assocMeta.modelMeta.id,
            assocTableData
          );

          importedCount += assocTableData.length;
          assocTableData = [];
        }
        resolve(true);
      });
    });

    nestedLinkCnt += importedCount;
  }
  return nestedLinkCnt;
}
