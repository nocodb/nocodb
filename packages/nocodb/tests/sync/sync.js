const Api = require('nocodb-sdk').Api;
const jsonfile = require('jsonfile');
const { UITypes } = require('nocodb-sdk');

const syncDB = {
  airtable: {
    apiKey: 'keyeZla3k0desT8fU',
    baseId: 'appb8CCITtLXZsYqV'
  }
};

const api = new Api({
  baseURL: 'http://localhost:8080',
  headers: {
    'xc-auth':
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfYXZmd2Z4bmNsaGQzcG8iLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTAyODIxMzh9.WRXsAjEk9-tF_TGk5gOLhD8S-4TURAZZtPDAumj4M7c'
  }
});

// global schema store
let aTblSchema = {};

function getAtableSchema() {
  let file = jsonfile.readFileSync('./t0v0.json');
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

// Nc: retrieve column datatype from column-name
//


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
      else if (col.typeOptions?.format === 'duration') ncType = UITypes.Duration;
      else if (col.typeOptions?.format === 'currency') ncType = UITypes.Currency;
      break;

    case 'formula':
      if (col.typeOptions?.formulaTextParsed === 'CREATED_TIME()') ncType = UITypes.CreateTime;
      else if (col.typeOptions?.formulaTextParsed === 'LAST_MODIFIED_TIME()') ncType = UITypes.LastModifiedTime;
      break;
    /**
    case 'foreignKey':
      break;
    case 'multilineText':
      break;
    case 'multipleAttachment':
      break;
    case 'checkbox':
      break;
    case 'multiSelect':
      break;
    case 'select':
      break;
    case 'collaborator':
      break;
    case 'date':
      break;
    case 'phone':
      break;
    case 'rating':
      break;
    case 'rollup':
      break;
    case 'count':
      break;
    case 'lookup':
      break;
    case 'computation':
      break;
    case 'autoNumber':
      break;
    case 'barcode':
      break;
    case 'button':
      break;
 **/
  }

  return ncType;
}

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

    // case `foreignKey`:
    //   return {
    //     type: 'manyToMany',
    //     data: aTbl_getTableName(tOpt.foreignTableId)
    //   };
    // case `lookup`:
    //   return {
    //     type: 'lookup',
    //     data: aTbl_getColumnName(tOpt.foreignTableRollupColumnId)
    //   };
    // case `rollup`:
    //   let fnValue = findRollupAggregatorMap(tOpt.formulaTextParsed);
    //   return {
    //     type: 'rollup',
    //     data: aTbl_getColumnName(tOpt.foreignTableRollupColumnId),
    //     fn: fnValue
    //   };

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
    table.columns = [{
      title: 'record_id',
      column_name: 'record_id',
      uidt: UITypes.ID
    }];

    for (let j = 0; j < tblSchema[i].columns.length; j++) {
      let col = tblSchema[i].columns[j];

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

// async function tablesCreate() {}

async function nocoCreateSchema(srcSchema) {
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

  // console.log(table)

  base(table.title)
    .select({
      pageSize: 2,
      maxRecords:2,
      view: 'Grid view'
    })
    .eachPage(
      function page(records, fetchNextPage) {

        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>`)
        console.log(JSON.stringify(records, null, 2));
        // This function (`page`) will get called for each page of records.
        records.forEach(function(record) {

          (async()=>{
            let rec = record.fields

            // kludge -
            // trim spaces on either side of column name
            // leads to error in NocoDB
            Object.keys(rec).forEach((key) => {
              let replacedKey = key.trim();
              if (key !== replacedKey) {
                rec[replacedKey] = rec[key];
                delete rec[key];
              }
            });

            // post-processing on the record
            for (const [key, value] of Object.entries(rec)) {

              // retrieve datatype
              let dt = table.columns.find(x => x.title === key).uidt

              // https://www.npmjs.com/package/validator
              // default value: digits_after_decimal: [2]
              // if currency, set decimal place to 2
              //
              if(dt === 'Currency')
                rec[key] = value.toFixed(2)
            }

            // bulk Insert
            let returnValue = await api.dbTableRow.bulkCreate('nc', 'sample-4', table.title, [rec])
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

(async () => {
  // read schema file
  const schema = getAtableSchema();

  // prepare table schema
  let ncTblSchema = await nocoCreateSchema(schema);

  // create empty project (XC-DB)
  let project = await api.project.create({
    title: 'sample-4'
  });

  // console.log(project)
  // console.log(project.id, project.bases[0].id);

  // for each table schema,
  //  a. create table
  //  b. populate data using airtable data APIs
  for (let idx = 0; idx < ncTblSchema.length; idx++) {
    let table = await api.dbTable.create(
      project.id,
      ncTblSchema[idx]
    );
    // console.log(table);

    // read data
    await nocoReadData(table)
  }

})().catch(e => {
  console.log(e);
});


// Scratch pad
// await api.dbTableRow.bulkInsert('nc', 'x', 'x', [{Title: 'abc'}, {Title: 'abc'}, {Title: 'abc'}])
// await api.data.bulkInsert();
// let column = await api.meta.columnCreate('md_vnesap07k24lku', {
//   uidt: UITypes.SingleLineText,
//   cn: 'col-1',
// })