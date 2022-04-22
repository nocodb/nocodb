const Api = require('nocodb-sdk').Api;
const jsonfile = require('jsonfile');
const { UITypes } = require('nocodb-sdk');

// apiKey & baseID configurations required to read data using Airtable APIs
//
const syncDB = {
  airtable: {
    apiKey: 'keyeZla3k0desT8fU',
    // baseId: 'appb8CCITtLXZsYqV',
    baseId: 'appNGAcKwq7eq0xuY'
  }
};

const api = new Api({
  baseURL: 'http://localhost:8080',
  headers: {
    'xc-auth':
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfN2NuZmpxMGt5NjczaXkiLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTA0NzM3MTl9.VVZKink3FSpajxnfaTVPn2iuCNH3lTjepNQNb4Q8VOE'
  }
});

// global schema store
let aTblSchema = {};

function getAtableSchema() {
  // let file = jsonfile.readFileSync('./t0v0.json');
  let file = jsonfile.readFileSync('./ltar.json');

  // store copy of atbl schema globally
  aTblSchema = file.tableSchemas;
  return file;
}

// base mapping table
let aTblNcTypeMap = {
  foreignKey: UITypes.LinkToAnotherRecord,
  text: UITypes.SingleLineText,
  multilineText: UITypes.LongText,
  multipleAttachment: UITypes.Attachment,
  checkbox: UITypes.Checkbox,
  multiSelect: UITypes.MultiSelect,
  select: UITypes.SingleSelect,
  collaborator: UITypes.Collaborator,
  date: UITypes.Date,
  phone: UITypes.PhoneNumber,
  number: UITypes.Number,
  rating: UITypes.Rating,
  formula: UITypes.Formula,
  rollup: UITypes.Rollup,
  count: UITypes.Count,
  lookup: UITypes.Lookup,
  autoNumber: UITypes.AutoNumber,
  barcode: UITypes.Barcode,
  button: UITypes.Button
};

//-----------------------------------------------------------------------------
// aTbl helper routines
//

// aTbl: retrieve table name from table ID
//
function aTbl_getTableName(tblId) {
  const sheetObj = aTblSchema.find(tbl => tbl.id === tblId);
  return {
    tn: sheetObj.name
  };
}

// aTbl: retrieve column name from column ID
//
function aTbl_getColumnName(colId) {
  for (let i = 0; i < aTblSchema.length; i++) {
    let sheetObj = aTblSchema[i];
    const column = sheetObj.columns.find(col => col.id === colId);
    if (column !== undefined)
      return {
        tn: sheetObj.name,
        cn: column.name
      };
  }
}

// nc dump schema
//
async function nc_DumpTableSchema() {
  console.log('[')
  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id)
  for(let i=0; i<ncTblList.list.length; i++) {
    let ncTbl = await api.dbTable.read(ncTblList.list[i].id)
    console.log(JSON.stringify(ncTbl, null, 2))
    console.log(',')
  }
  console.log(']')
}

// retrieve nc column schema from using aTbl field ID as reference
//
async function nc_getColumnSchema(aTblFieldId) {
  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
  let aTblField = aTbl_getColumnName(aTblFieldId);
  let ncTblId = ncTblList.list.filter(x => x.title === aTblField.tn)[0].id;
  let ncTbl = await api.dbTable.read(ncTblId);
  let ncCol = ncTbl.columns.find(x => x.title === aTblField.cn);
  return ncCol;
}

// retrieve nc table schema using table name
async function nc_getTableSchema(tableName) {
  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
  let ncTblId = ncTblList.list.filter(x => x.title === tableName)[0].id;
  let ncTbl = await api.dbTable.read(ncTblId);
  return ncTbl;
}


// map UIDT
//
function getNocoType(col) {
  // start with default map
  let ncType = aTblNcTypeMap[col.type];

  // types email & url are marked as text
  // types currency & percent, duration are marked as number
  // types createTime & modifiedTime are marked as formula

  switch (col.type) {
    case 'text':
      if (col.typeOptions?.validatorName === 'email') ncType = UITypes.Email;
      else if (col.typeOptions?.validatorName === 'url') ncType = UITypes.URL;
      break;

    case 'number':
      // kludge: currency validation error with decimal places
      if (col.typeOptions?.format === 'percentV2') ncType = UITypes.Percent;
      else if (col.typeOptions?.format === 'duration')
        ncType = UITypes.Duration;
      else if (col.typeOptions?.format === 'currency')
        ncType = UITypes.Currency;
      break;

    case 'formula':
      if (col.typeOptions?.formulaTextParsed === 'CREATED_TIME()')
        ncType = UITypes.CreateTime;
      else if (col.typeOptions?.formulaTextParsed === 'LAST_MODIFIED_TIME()')
        ncType = UITypes.LastModifiedTime;
      break;
  }

  return ncType;
}

// retrieve additional options associated with selected data types
//
function getNocoTypeOptions(col) {
  switch (col.type) {
    case 'select':
    case 'multiSelect':
      // prepare options list in CSV format
      // note: NC doesn't allow comma's in options
      //
      let opt = [];
      for (let [, value] of Object.entries(col.typeOptions.choices)) {
        opt.push(value.name);
      }
      let csvOpt = "'" + opt.join("','") + "'";
      return { type: 'select', data: csvOpt };

    default:
      return { type: undefined };
  }
}

// convert to Nc schema
//
function tablesPrepare(tblSchema) {
  let tables = [];
  for (let i = 0; i < tblSchema.length; ++i) {
    let table = {};

    // table name
    table.table_name = tblSchema[i].name;

    // insert record_id of type ID by default
    table.columns = [
      {
        title: 'record_id',
        column_name: 'record_id',
        uidt: UITypes.ID
      }
    ];

    for (let j = 0; j < tblSchema[i].columns.length; j++) {
      let col = tblSchema[i].columns[j];

      // skip link, lookup, rollup fields in this iteration
      if (['foreignKey', 'lookup', 'rollup'].includes(col.type)) continue;

      // base column schema
      // kludge: error observed in Nc with space around column-name
      let ncCol = {
        title: col.name.trim(),
        column_name: col.name.trim(),
        uidt: getNocoType(col)
      };

      // additional column parameters when applicable
      let colOptions = getNocoTypeOptions(col);

      switch (colOptions.type) {
        case 'select':
          ncCol.dtxp = colOptions.data;
          break;

        case undefined:
          break;
      }

      table.columns.push(ncCol);
    }

    tables.push(table);
  }
  return tables;
}


async function nocoCreateSchema(srcSchema) {
  // base schema preparation: exclude
  let tables = tablesPrepare(srcSchema.tableSchemas);

  // debug
  // console.log(JSON.stringify(tables, null, 2));
  return tables;
}

//////////  Data processing

// https://www.airtable.com/app1ivUy7ba82jOPn/api/docs#javascript/metadata
let Airtable = require('airtable');
let base = new Airtable({ apiKey: syncDB.airtable.apiKey }).base(
  syncDB.airtable.baseId
);

async function nocoReadData(table) {

  base(table.title)
    .select({
      pageSize: 25,
      // maxRecords: 100,
      view: 'Grid view'
    })
    .eachPage(
      function page(records, fetchNextPage) {
        console.log(JSON.stringify(records, null, 2));


        // This function (`page`) will get called for each page of records.
        records.forEach(function(record) {
          (async () => {
            let rec = record.fields;

            // kludge -
            // trim spaces on either side of column name
            // leads to error in NocoDB
            Object.keys(rec).forEach(key => {
              let replacedKey = key.trim();
              if (key !== replacedKey) {
                rec[replacedKey] = rec[key];
                delete rec[key];
              }
            });

            // post-processing on the record
            for (const [key, value] of Object.entries(rec)) {
              // retrieve datatype
              let dt = table.columns.find(x => x.title === key).uidt;

              // https://www.npmjs.com/package/validator
              // default value: digits_after_decimal: [2]
              // if currency, set decimal place to 2
              //
              if (dt === 'Currency') rec[key] = value.toFixed(2);
            }

            // bulk Insert
            let returnValue = await api.dbTableRow.bulkCreate(
              'nc',
              'sample-4',
              table.title,
              [rec]
            );
          })().catch(e => {
            console.log(e);
          });
        });

        // To fetch the next page of records, call `fetchNextPage`.
        // If there are more records, `page` will get called again.
        // If there are no more records, `done` will get called.
        fetchNextPage();
      },
      function done(err) {
        if (err) {
          console.error(err);
        }
      }
    );
}

//////////
// holds response for all created tables
let ncCreatedProjectSchema = [];
let ncLinkMappingTable = [];

function nc_isLinkExists(atblFieldId) {
  if(ncLinkMappingTable.find(x => x.aTbl.typeOptions.symmetricColumnId === atblFieldId))
    return true;
  return false;
}

// start function
(async () => {
  // read schema file
  const schema = getAtableSchema();
  let aTblSchema = schema.tableSchemas;

  // create empty project (XC-DB)
  ncCreatedProjectSchema = await api.project.create({
    title: 'sample-4'
  });

  // prepare table schema (basic)
  let ncTblSchema = await nocoCreateSchema(schema);

  // for each table schema, create nc table
  for (let idx = 0; idx < ncTblSchema.length; idx++) {
    let table = await api.dbTable.create(
      ncCreatedProjectSchema.id,
      ncTblSchema[idx]
    );
  }

  // Link to another RECORD
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let aTblLinkColumns = aTblSchema[idx].columns.filter(
      x => x.type === 'foreignKey'
    );

    // Link columns exist
    //
    if (aTblLinkColumns.length) {
      for (let i = 0; i < aTblLinkColumns.length; i++) {

        // check if link already established?
        if(!nc_isLinkExists(aTblLinkColumns[i].id)) {

          // parent table ID
          let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;

          // find child table name from symmetric column ID specified
          let childTable = aTbl_getColumnName(
            aTblLinkColumns[i].typeOptions.symmetricColumnId
          );

          // retrieve child table ID (nc) from table name
          let childTableId = (await nc_getTableSchema(childTable.tn)).id;

          // create link
          let column = await api.dbTableColumn.create(srcTableId, {
            uidt: 'LinkToAnotherRecord',
            title: aTblLinkColumns[i].name,
            parentId: srcTableId,
            childId: childTableId,
            type: aTblLinkColumns[i].typeOptions.relationship === 'many'
                ? 'mm'
                : 'hm'
          });

          // store link information in separate table
          // this information will be helpful in identifying relation pair
          let link = {
            nc: {
              title: aTblLinkColumns[i].name,
              parentId: srcTableId,
              childId: childTableId,
              type: 'hm'
            },
            aTbl: {
              tblId: aTblSchema[idx].id,
              ...aTblLinkColumns[i]
            }
          };

          ncLinkMappingTable.push(link);
        } else {

          // if link already exists, we need to change name of linked column
          // to what is represented in airtable

          // 1. extract associated link information from link table
          // 2. retrieve parent table information (source)
          // 3. using foreign parent & child column ID, find associated mapping in child table
          // 4. update column name
          let x = ncLinkMappingTable.findIndex(
            x =>
              x.aTbl.tblId === aTblLinkColumns[i].typeOptions.foreignTableId &&
              x.aTbl.id ===
                aTblLinkColumns[i].typeOptions.symmetricColumnId
          );

          let childTblSchema = await api.dbTable.read(
            ncLinkMappingTable[x].nc.childId
          );
          let parentTblSchema = await api.dbTable.read(
            ncLinkMappingTable[x].nc.parentId
          );

          let parentLinkColumn = parentTblSchema.columns.find(
            col => col.title === ncLinkMappingTable[x].nc.title
          );

          let childLinkColumn = {};
          if (parentLinkColumn.colOptions.type == 'hm') {
            // for hm:
            // mapping between child & parent column id is direct
            //
            childLinkColumn = childTblSchema.columns.find(
              col =>
                col.uidt === 'LinkToAnotherRecord' &&
                col.colOptions.fk_child_column_id ===
                  parentLinkColumn.colOptions.fk_child_column_id &&
                col.colOptions.fk_parent_column_id ===
                  parentLinkColumn.colOptions.fk_parent_column_id
            );
          } else {
            // for mm:
            // mapping between child & parent column id is inverted
            //
            childLinkColumn = childTblSchema.columns.find(
              col =>
                col.uidt === 'LinkToAnotherRecord' &&
                col.colOptions.fk_child_column_id ===
                  parentLinkColumn.colOptions.fk_parent_column_id &&
                col.colOptions.fk_parent_column_id ===
                  parentLinkColumn.colOptions.fk_child_column_id
            );
          }

          // rename
          // note that: current rename API requires us to send all parameters,
          // not just title being renamed
          await api.dbTableColumn.update(childLinkColumn.id, {
            ...childLinkColumn,
            title: aTblLinkColumns[i].name
          });
        }
      }
    }
  }

  // LookUps
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let aTblColumns = aTblSchema[idx].columns.filter(x => x.type === 'lookup');

    // parent table ID
    let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;

    if (aTblColumns.length) {
      // Lookup
      for (let i = 0; i < aTblColumns.length; i++) {
        let ncRelationColumn = await nc_getColumnSchema(
          aTblColumns[i].typeOptions.relationColumnId
        );
        let ncLookupColumn = await nc_getColumnSchema(
          aTblColumns[i].typeOptions.foreignTableRollupColumnId
        );

        let lookupColumn = await api.dbTableColumn.create(srcTableId, {
          uidt: 'Lookup',
          title: aTblColumns[i].name,
          fk_relation_column_id: ncRelationColumn.id,
          fk_lookup_column_id: ncLookupColumn.id
        });
      }
    }
  }

  // Rollups
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let aTblColumns = aTblSchema[idx].columns.filter(x => x.type === 'rollup');

    // parent table ID
    let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;

    if (aTblColumns.length) {
      // rollup exist
      for (let i = 0; i < aTblColumns.length; i++) {
        let ncRelationColumn = await nc_getColumnSchema(
          aTblColumns[i].typeOptions.relationColumnId
        );
        let ncRollupColumn = await nc_getColumnSchema(
          aTblColumns[i].typeOptions.foreignTableRollupColumnId
        );

        let lookupColumn = await api.dbTableColumn.create(srcTableId, {
          uidt: 'Rollup',
          title: aTblColumns[i].name,
          fk_relation_column_id: ncRelationColumn.id,
          fk_rollup_column_id: ncRollupColumn.id,
          rollup_function: 'sum' // fix me: hardwired
        });
      }
    }
  }

  // await nc_DumpTableSchema();

  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id)
  for(let i=0; i<ncTblList.list.length; i++) {
    let ncTbl = await api.dbTable.read(ncTblList.list[i].id)
    await nocoReadData(ncTbl)
  }

  })().catch(e => {
  console.log(e);
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// Scratch pad


// await api.dbTableRow.bulkInsert('nc', 'x', 'x', [{Title: 'abc'}, {Title: 'abc'}, {Title: 'abc'}])
// await api.data.bulkInsert();
// let column = await api.meta.columnCreate('md_vnesap07k24lku', {
//   uidt: UITypes.SingleLineText,
//   cn: 'col-1',
// })


// // t0 schema
// let t0 = {
//   table_name: 't0',
//   columns: [
//     {
//       title: 'record_id',
//       column_name: 'record_id',
//       uidt: 'ID'
//     },
//     {
//       title: 'Segment1',
//       column_name: 'Segment',
//       uidt: 'LongText'
//     }
//   ]
// };
// let t1 = {
//   table_name: 't1',
//   columns: [
//     {
//       title: 'record_id',
//       column_name: 'record_id',
//       uidt: 'ID'
//     },
//     {
//       title: 'Segment2',
//       column_name: 'Segment',
//       uidt: 'LongText'
//     }
//   ]
// };

// (async () => {
//   return;
//
//   // create empty project (XC-DB)
//   let project = await api.project.create({
//     title: 'sample-a'
//   });
//
//   let table_1 = await api.dbTable.create(project.id, t0);
//
//   let table_2 = await api.dbTable.create(project.id, t1);
//
//   // console.log(project, table_1, table_2)
//
//   let LTAR = await api.dbTableColumn.create(table_1.id, {
//     uidt: 'LinkToAnotherRecord',
//     title: 'LinkField',
//     parentId: table_1.id,
//     childId: table_2.id,
//     type: 'hm'
//   });
//
//   // console.log(LTAR)
//
//   let lookupColumn = await api.dbTableColumn.create(table_1.id, {
//     uidt: 'Lookup',
//     title: 'LookUP Field',
//     fk_relation_column_id: LTAR.columns.find(o => o.title === 'LinkField').id,
//     fk_lookup_column_id: table_2.columns.find(o => o.title === 'Segment2').id
//   });
//
//   let rollupColumn = await api.dbTableColumn.create(table_1.id, {
//     uidt: 'Rollup',
//     title: 'RollUP Field',
//     fk_relation_column_id: LTAR.columns.find(o => o.title === 'LinkField').id,
//     fk_rollup_column_id: table_2.columns.find(o => o.title === 'Segment2').id,
//     rollup_function: 'count'
//   });
//
//   await api.dbTableRow.create('noco', project.title, table_2.title, {
//     Segment2: 'tbl-0 record 1'
//   });
//   await api.dbTableRow.create('noco', project.title, table_2.title, {
//     Segment2: 'tbl-0 record 2'
//   });
//   await api.dbTableRow.create('noco', project.title, table_2.title, {
//     Segment2: 'tbl-0 record 3'
//   });
//
//   await api.dbTableRow.create('noco', project.title, table_1.title, {
//     Segment1: 'tbl-1 record 1'
//   });
//   await api.dbTableRow.nestedAdd(
//     'noco',
//     project.title,
//     table_1.title,
//     '1',
//     'mm',
//     'LinkField',
//     '1'
//   );
//   await api.dbTableRow.nestedAdd(
//     'noco',
//     project.title,
//     table_1.title,
//     '1',
//     'mm',
//     'LinkField',
//     '2'
//   );
// })().catch(e => {
//   console.log(e);
// });