import { AirtableBase } from 'airtable/lib/airtable_base';
import { Api, RelationTypes, TableType, UITypes } from 'nocodb-sdk';

const BULK_DATA_BATCH_SIZE = 2000;
const ASSOC_BULK_DATA_BATCH_SIZE = 2000;

async function readAllData({
  table,
  fields,
  base,
  logBasic = _str => {},
  triggerThreshold = BULK_DATA_BATCH_SIZE,
  onThreshold = async _rec => {}
}: {
  table: { title?: string };
  fields?;
  base: AirtableBase;
  logBasic?: (string) => void;
  logDetailed?: (string) => void;
  triggerThreshold?: number;
  onThreshold?: (
    records: Array<{ fields: any; id: string }>,
    allRecords?: Array<{ fields: any; id: string }>
  ) => Promise<void>;
}): Promise<Array<any>> {
  return new Promise((resolve, reject) => {
    const data = [];
    let thresholdCbkData = [];

    const selectParams: any = {
      pageSize: 100
    };

    if (fields) selectParams.fields = fields;

    base(table.title)
      .select(selectParams)
      .eachPage(
        async function page(records, fetchNextPage) {
          data.push(...records);
          thresholdCbkData.push(...records);

          logBasic(
            `:: Reading '${table.title}' data :: ${Math.max(
              1,
              data.length - records.length
            )} - ${data.length}`
          );

          if (thresholdCbkData.length >= triggerThreshold) {
            await onThreshold(thresholdCbkData, data);
            thresholdCbkData = [];
          }

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
          if (thresholdCbkData.length) {
            await onThreshold(thresholdCbkData, data);
            thresholdCbkData = [];
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
  logDetailed = _str => {},
  logBasic = _str => {}
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
}): Promise<any> {
  try {
    // @ts-ignore
    const records = await readAllData({
      table,
      base,
      logDetailed,
      logBasic,
      async onThreshold(records, allRecords) {
        const allData = [];
        for (let i = 0; i < records.length; i++) {
          const r = await nocoBaseDataProcessing_v2(sDB, table, records[i]);
          allData.push(r);
        }

        logBasic(
          `:: Importing '${table.title}' data :: ${allRecords.length -
            records.length +
            1} - ${allRecords.length}`
        );
        await api.dbTableRow.bulkCreate('nc', projectName, table.id, allData);
      }
    });

    return records;
  } catch (e) {
    console.log(e);
  }
}

export async function importLTARData({
  table,
  fields,
  base,
  api,
  projectName,
  insertedAssocRef = {},
  logDetailed = _str => {},
  logBasic = _str => {},
  records
}: {
  projectName: string;
  table: { title?: string; id?: string };
  fields;
  base: AirtableBase;
  logDetailed: (string) => void;
  logBasic: (string) => void;
  api: Api<any>;
  insertedAssocRef: { [assocTableId: string]: boolean };
  records?: Array<{ fields: any; id: string }>;
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
      logBasic
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
        c => c.id === colMeta.colOptions.fk_mm_child_column_id
      ),
      refCol: assocModelMeta.columns.find(
        c => c.id === colMeta.colOptions.fk_mm_parent_column_id
      )
    });
  }

  // Iterate over all related M2M associative  table
  for (const assocMeta of assocTableMetas) {
    const insertData = [];

    //  extract insert data from records
    for (const record of allData) {
      const rec = record.fields;

      // todo: use actual alias instead of sanitized
      insertData.push(
        ...(rec?.[assocMeta.colMeta.title] || []).map(id => ({
          [assocMeta.curCol.title]: record.id,
          [assocMeta.refCol.title]: id
        }))
      );
    }

    // Insert datas as chunks of size `ASSOC_BULK_DATA_BATCH_SIZE`
    for (
      let i = 0;
      i < insertData.length / ASSOC_BULK_DATA_BATCH_SIZE;
      i += ASSOC_BULK_DATA_BATCH_SIZE
    ) {
      logBasic(
        `:: Importing '${table.title}' LTAR data :: ${i + 1} - ${Math.min(
          i + ASSOC_BULK_DATA_BATCH_SIZE,
          allData.length
        )}`
      );
      await api.dbTableRow.bulkCreate(
        'nc',
        projectName,
        assocMeta.modelMeta.id,
        insertData.slice(i, ASSOC_BULK_DATA_BATCH_SIZE)
      );
    }
  }
}
