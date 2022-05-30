import { AirtableBase } from 'airtable/lib/airtable_base';
import { Api, RelationTypes, TableType, UITypes } from 'nocodb-sdk';

async function readAllATData({
  table,
  fields,
  base
}: // logBasic = _str => ()
{
  table: { title?: string };
  fields?;
  base: AirtableBase;
  logBasic?: (string) => void;
}): Promise<Array<any>> {
  return new Promise((resolve, reject) => {
    const data = [];
    const selectParams: any = {
      pageSize: 100
    };
    if (fields) selectParams.fields = fields;

    base(table.title)
      .select(selectParams)
      .eachPage(
        async function page(records, fetchNextPage) {
          // console.log(JSON.stringify(records, null, 2));

          // This function (`page`) will get called for each page of records.
          // records.forEach(record => callback(table, record));
          // logBasic(
          //   `:: ${table.title} / ${fields} : ${recordCnt +
          //   1} ~ ${(recordCnt += 100)}`
          // );
          data.push(...records);

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            reject(err);
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
  sDB
}: // logBasic = _str => ()
{
  projectName: string;
  table: { title?: string; id?: string };
  fields?;
  base: AirtableBase;
  logBasic: (string) => void;
  api: Api<any>;
  nocoBaseDataProcessing_v2;
  sDB;
}) {
  try {
    // get all data from a table
    const allData = [];
    const records = await readAllATData({
      table,
      base
    });

    for (let i = 0; i < records.length; i++) {
      const r = await nocoBaseDataProcessing_v2(sDB, table, records[i]);
      allData.push(r);
    }

    for (let i = 0; i < allData.length / 2000; i += 2000) {
      await api.dbTableRow.bulkCreate(
        'nc',
        projectName,
        table.id, // encodeURIComponent(table.title),
        allData.slice(i, 2000)
      );
    }
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
  insertedAssocRef = {}
}: // logBasic = _str => ()
{
  projectName: string;
  table: { title?: string; id?: string };
  fields;
  base: AirtableBase;
  logBasic: (string) => void;
  api: Api<any>;
  insertedAssocRef: { [assocId: string]: boolean };
}) {
  const assocTableMetas: Array<{
    modelMeta: { id?: string; title?: string };
    colMeta: { title?: string };
    curCol: { title?: string };
    refCol: { title?: string };
  }> = [];
  const allData = await readAllATData({ table, fields, base });

  const modelMeta: any = await api.dbTable.read(table.id);

  for (const colMeta of modelMeta.columns) {
    if (
      colMeta.uidt !== UITypes.LinkToAnotherRecord ||
      colMeta.colOptions.type !== RelationTypes.MANY_TO_MANY
    ) {
      continue;
    }

    if (colMeta.colOptions.fk_mm_model_id in insertedAssocRef) continue;

    insertedAssocRef[colMeta.colOptions.fk_mm_model_id] = true;

    const assocModelMeta: TableType = (await api.dbTable.read(
      colMeta.colOptions.fk_mm_model_id
    )) as any;

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

  for (const assocMeta of assocTableMetas) {
    const insertData = [];
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

    for (let i = 0; i < insertData.length / 2000; i += 2000) {
      await api.dbTableRow.bulkCreate(
        'nc',
        projectName,
        assocMeta.modelMeta.id,
        insertData.slice(i, 2000)
      );
    }
  }
}

// for (const [key, value] of Object.entries(rec)) {
//   const refRowIdList: any = value;
//   const referenceColumnName = key;
//
//   if (refRowIdList.length) {
//     for (let i = 0; i < refRowIdList.length; i++) {
//       logDetailed(
//         `NC API: dbTableRow.nestedAdd ${record.id}/mm/${referenceColumnName}/${refRowIdList[0][i]}`
//       );
//
//       const _perfStart = recordPerfStart();
//       await api.dbTableRow.nestedAdd(
//         'noco',
//         projName,
//         table.id,
//         `${record.id}`,
//         'mm',
//         encodeURIComponent(referenceColumnName),
//         `${refRowIdList[i]}`
//       );
//       recordPerfStats(_perfStart, 'dbTableRow.nestedAdd');
//     }
//   }
// }
//   }
// }
