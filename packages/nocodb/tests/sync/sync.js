const Api = require('nocodb-sdk').Api;
const axios = require('axios');
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
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfejFidzZ4MG9ibzI2bW8iLCJyb2xlcyI6InVzZXIiLCJpYXQiOjE2NDkyMjM4NDV9.1M9pr4TCZTGRzWjf54TRonKFG67PuDTMN6PZPA_dp9Y'
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
    if (column != undefined)
      return {
        tn: sheetObj.name,
        cn: column.name
      };
  }
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
      if (col.typeOptions && col.typeOptions.validatorName) {
        if (col.typeOptions.validatorName === 'email') ncType = UITypes.Email;
        else if (col.typeOptions.validatorName === 'url') ncType = UITypes.URL;
      }
      break;

    case 'number':
      if (col.typeOptions && col.typeOptions.format) {
        if (col.typeOptions.format === 'currency') ncType = UITypes.Currency;
        else if (col.typeOptions.format === 'percentV2')
          ncType = UITypes.Percent;
        else if (col.typeOptions.format === 'duration')
          ncType = UITypes.Duration;
      }
      break;

    case 'formula':
      if (col.typeOptions && col.typeOptions.formulaTextParsed) {
        if (col.typeOptions.formulaTextParsed === 'CREATED_TIME()')
          ncType = UITypes.CreateTime;
        else if (col.typeOptions.formulaTextParsed === 'LAST_MODIFIED_TIME()')
          ncType = UITypes.LastModifiedTime;
      }
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
  const tOpt = col.typeOptions;
  switch (col.type) {
    case 'select':
    case 'multiSelect':
      let opt = [];
      for (let [key, value] of Object.entries(col.typeOptions.choices)) {
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

function tablesPrepare(tblSchema) {
  let tables = [];
  for (let i = 0; i < tblSchema.length; ++i) {
    let table = {};

    table.table_name = tblSchema[i].name;
    table.columns = [{
      title: 'record_id',
      column_name: 'record_id',
      uidt: UITypes.ID
    }];

    for (let j = 0; j < tblSchema[i].columns.length; j++) {
      let col = tblSchema[i].columns[j];
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

async function tablesCreate() {}

async function nocoCreateSchema(srcSchema) {
  let tables = tablesPrepare(srcSchema.tableSchemas);

  // debug
  console.log(JSON.stringify(tables, null, 2));
  return tables;
}

//////////  Data processing


// https://www.airtable.com/app1ivUy7ba82jOPn/api/docs#javascript/metadata
let Airtable = require('airtable');
let base = new Airtable({ apiKey: syncDB.airtable.apiKey }).base(
  syncDB.airtable.baseId
);

async function nocoReadData(tableName) {
  base(tableName)
    .select({
      pageSize: 10,
      maxRecords:20,
      view: 'Grid view'
    })
    .eachPage(
      function page(records, fetchNextPage) {
        // This function (`page`) will get called for each page of records.
        records.forEach(function(record) {

          (async()=>{
            // await api.dbTableRow.bulkInsert('nc', 'sample-1', 'Finance', [record.fields])
            let rec = record.fields
            Object.keys(rec).forEach((key) => {
              let replacedKey = key.trim();
              if (key !== replacedKey) {
                rec[replacedKey] = rec[key];
                delete rec[key];
              }
            });
            console.log(rec)
            let returnValue = await api.dbTableRow.bulkInsert('nc', 'sample-3', 'Finance', [rec])
            console.log('>>', returnValue)
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
          return;
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
    title: 'sample-3'
  });

  // console.log(project)
  // console.log(project.id, project.bases[0].id);

  for (let idx = 0; idx < ncTblSchema.length; idx++) {
    let table = await api.dbTable.create(
      project.id,
      ncTblSchema[idx]
    );
    console.log(table);
  }

  // read data
  await nocoReadData('Finance')

  // await api.dbTableRow.bulkInsert('nc', 'x', 'x', [{Title: 'abc'}, {Title: 'abc'}, {Title: 'abc'}])

  // await api.data.bulkInsert();

  // let column = await api.meta.columnCreate('md_vnesap07k24lku', {
  //   uidt: UITypes.SingleLineText,
  //   cn: 'col-1',
  // })
})().catch(e => {
  console.log(e);
});

//
// let aTblNcTypeMap = {
//   "Link to another record": {
//     atType: "foreignKey",
//     ncType: UITypes.LinkToAnotherRecord
//   },
//   "Single line text": {
//     atType: "text",
//     ncType: UITypes.SingleLineText
//   },
//   "Long text": {
//     atType: "multilineText",
//     ncType: UITypes.LongText
//   },
//   "Attachment": {
//     atType: "multipleAttachment",
//     ncType: UITypes.Attachment
//   },
//   "Checkbox": {
//     atType: "checkbox",
//     ncType: UITypes.Checkbox
//   },
//   "Multiple select": {
//     atType: "multiSelect",
//     ncType: UITypes.MultiSelect
//   },
//   "Single select": {
//     atType: "select",
//     ncType: UITypes.SingleSelect
//   },
//   "Collaborator": {
//     atType: "collaborator",
//     ncType: UITypes.Collaborator
//   },
//   "Date": {
//     atType: "date",
//     ncType: UITypes.Date
//   },
//   "Phone number": {
//     atType: "phone",
//     ncType: UITypes.PhoneNumber
//   },
//   "Email": {
//     atType: "text",
//     ncType: UITypes.Email
//   },
//   "URL": {
//     atType: "text",
//     ncType: UITypes.URL
//   },
//   "Number": {
//     atType: "number",
//     ncType: UITypes.Number
//   },
//   "Currency": {
//     atType: "number",
//     ncType: UITypes.Currency
//   },
//   "Percent": {
//     atType: "number",
//     ncType: UITypes.Percent
//   },
//   "Duration": {
//     atType: "number",
//     ncType: UITypes.Duration
//   },
//   "Rating": {
//     atType: "rating",
//     ncType: UITypes.Rating
//   },
//   "Formula": {
//     atType: "formula",
//     ncType: UITypes.Formula
//   },
//   "Rollup": {
//     atType: "rollup",
//     ncType: UITypes.Rollup
//   },
//   "Count": {
//     atType: "count",
//     ncType: UITypes.Count
//   },
//   "Lookup": {
//     atType: "lookup",
//     ncType: UITypes.Lookup
//   },
//   "Create time": {
//     atType: "formula",
//     ncType: UITypes.CreateTime
//   },
//   "Last modified time": {
//     atType: "formula",
//     ncType: UITypes.LastModifiedTime
//   },
//   "Created by": {
//     atType: "computation",
//     ncType: ""
//   },
//   "Last modified by": {
//     atType: "computation",
//     ncType: ""
//   },
//   "Autonumber": {
//     atType: "autoNumber",
//     ncType: UITypes.AutoNumber
//   },
//   "Barcode": {
//     atType: "barcode",
//     ncType: UITypes.Barcode
//   },
//   "Button": {
//     atType: "button",
//     ncType: UITypes.Button
//   },
// }
