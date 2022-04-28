const Api = require('nocodb-sdk').Api;
const jsonfile = require('jsonfile');
const { UITypes } = require('nocodb-sdk');
const axios = require('axios').default;
const FormData = require('form-data');

function syncLog(log) {
  console.log(log)
}

// read configurations
//
const syncDB = jsonfile.readFileSync('./config.json');

const api = new Api({
  baseURL: syncDB.baseURL,
  headers: {
    'xc-auth': syncDB.authToken
  }
});

// global schema store
let aTblSchema = {};

function getAtableSchema() {
  // let file = jsonfile.readFileSync('./t0v0.json');
  let file = jsonfile.readFileSync(syncDB.airtable.schemaJson);

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
  // kludge: phone: UITypes.PhoneNumber,
  phone: UITypes.SingleLineText,
  number: UITypes.Number,
  rating: UITypes.Rating,
  // kludge: formula: UITypes.Formula,
  formula: UITypes.SingleLineText,
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
  console.log('[');
  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
  for (let i = 0; i < ncTblList.list.length; i++) {
    let ncTbl = await api.dbTable.read(ncTblList.list[i].id);
    console.log(JSON.stringify(ncTbl, null, 2));
    console.log(',');
  }
  console.log(']');
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
// optimize: create a look-up table & re-use information
//
async function nc_getTableSchema(tableName) {
  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
  let ncTblId = ncTblList.list.filter(x => x.title === tableName)[0].id;
  let ncTbl = await api.dbTable.read(ncTblId);
  return ncTbl;
}

// delete project if already exists
async function init() {

  console.log(syncDB)

  // delete 'sample' project if already exists
  let x = await api.project.list()

  let sampleProj = x.list.find(a => a.title === syncDB.projectName)
  if(sampleProj) {
    await api.project.delete(sampleProj.id)
  }

  syncLog('Init')
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

// convert to Nc schema (basic, excluding relations)
//
function tablesPrepare(tblSchema) {
  let tables = [];
  for (let i = 0; i < tblSchema.length; ++i) {
    let table = {};

    syncLog(`Preparing base schema (sans relations): ${tblSchema[i].name}`)

    // Enable to use aTbl identifiers as is: table.id = tblSchema[i].id;
    table.table_name = tblSchema[i].name;
    table.title = tblSchema[i].name;

    // insert record_id of type ID by default
    table.columns = [
      {
        title: 'record_id',
        column_name: 'record_id',
        // uidt: UITypes.ID
        uidt: UITypes.SingleLineText,
        pk: true,
      }
    ];

    for (let j = 0; j < tblSchema[i].columns.length; j++) {
      let col = tblSchema[i].columns[j];

      // skip link, lookup, rollup fields in this iteration
      if (['foreignKey', 'lookup', 'rollup'].includes(col.type)) continue;

      // not supported datatype
      // if (['formula'].includes(col.type)) continue;

      // base column schema
      // kludge: error observed in Nc with space around column-name
      let ncCol = {
        // Enable to use aTbl identifiers as is: id: col.id,
        title: col.name.trim(),

        // knex complains use of '?' in field name
        //column_name: col.name.replace(/\?/g, '\\?').trim(),
        column_name: col.name.replace(/\?/g, 'QQ').trim(),
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

async function nocoCreateBaseSchema(aTblSchema) {
  // base schema preparation: exclude
  let tables = tablesPrepare(aTblSchema);

  // for each table schema, create nc table
  for (let idx = 0; idx < tables.length; idx++) {

    syncLog(`NC API: dbTable.create ${tables[idx].title}`)
    let table = await api.dbTable.create(
      ncCreatedProjectSchema.id,
      tables[idx]
    );

    // update default view name- to match it to airtable view name
    syncLog(`NC API: dbView.list ${table.id}`)
    let view = await api.dbView.list(table.id);

    syncLog(`NC API: dbView.update ${view.list[0].id} ${aTblSchema[idx].views[0].name}`)
    let x = await api.dbView.update(view.list[0].id, {title: aTblSchema[idx].views[0].name})
  }

  // debug
  // console.log(JSON.stringify(tables, null, 2));
  return tables;
}

async function nocoCreateLinkToAnotherRecord(aTblSchema) {
  // Link to another RECORD
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let aTblLinkColumns = aTblSchema[idx].columns.filter(
      x => x.type === 'foreignKey'
    );

    // Link columns exist
    //
    if (aTblLinkColumns.length) {
      for (let i = 0; i < aTblLinkColumns.length; i++) {

        {
          let src = aTbl_getColumnName(aTblLinkColumns[i].id)
          let dst = aTbl_getColumnName(aTblLinkColumns[i].typeOptions.symmetricColumnId)
          syncLog(`    LTAR ${src.tn}:${src.cn} <${aTblLinkColumns[i].typeOptions.relationship}> ${dst.tn}:${dst.cn}`)
        }

        // check if link already established?
        if (!nc_isLinkExists(aTblLinkColumns[i].id)) {
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
            type: 'mm'
              // aTblLinkColumns[i].typeOptions.relationship === 'many'
              //   ? 'mm'
              //   : 'hm'
          });
          syncLog(`NC API: dbTableColumn.create LinkToAnotherRecord`)

          // store link information in separate table
          // this information will be helpful in identifying relation pair
          let link = {
            nc: {
              title: aTblLinkColumns[i].name,
              parentId: srcTableId,
              childId: childTableId,
              type: 'mm'
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
              x.aTbl.id === aTblLinkColumns[i].typeOptions.symmetricColumnId
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
                  parentLinkColumn.colOptions.fk_child_column_id &&
                col.colOptions.fk_mm_model_id ===
                  parentLinkColumn.colOptions.fk_mm_model_id
            );
          }

          // rename
          // note that: current rename API requires us to send all parameters,
          // not just title being renamed
          let res = await api.dbTableColumn.update(childLinkColumn.id, {
            ...childLinkColumn,
            title: aTblLinkColumns[i].name,
          });
          // console.log(res.columns.find(x => x.title === aTblLinkColumns[i].name))
          syncLog(`NC API: dbTableColumn.update rename symmetric column`)
        }
      }
    }
  }
}

async function nocoCreateLookups(aTblSchema) {
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

        syncLog(`NC API: dbTableColumn.create LOOKUP`)
      }
    }
  }
}

async function nocoCreateRollups(aTblSchema) {
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

        syncLog(`NC API: dbTableColumn.create ROLLUP`)

      }
    }
  }
}

async function nocoSetPrimary(aTblSchema) {
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let pColId = aTblSchema[idx].primaryColumnId;
    let ncCol = await nc_getColumnSchema(pColId);

    syncLog(`NC API: dbTableColumn.primaryColumnSet`)
    await api.dbTableColumn.primaryColumnSet(ncCol.id);
  }
}

async function nc_hideColumn(tblName, viewName, columnName) {

  // retrieve table schema
  let ncTbl = await nc_getTableSchema(tblName)
  // retrieve view ID
  let viewId = ncTbl.views.find(x => x.title === viewName).id;
  // retrieve view Info
  let viewDetails = await api.dbView.gridColumnsList(viewId);

  for(i =0; i<columnName.length; i++) {
    // retrieve column schema
    let ncColumn = ncTbl.columns.find(x => x.title === columnName[i]);
    // retrieve view column ID
    let viewColumnId = viewDetails.find(x => x.fk_column_id === ncColumn.id).id
    // hide
    syncLog(`NC API: dbViewColumn.update ${viewId}, ${ncColumn.id}`)
    let retVal = await api.dbViewColumn.update(viewId, viewColumnId, { show: false })
  }
}

async function nocoReconfigureFields(aTblSchema) {
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let hiddenColumns = ["record_id"]

    // extract other columns hidden in this view
    let hiddenColumnID = aTblSchema[idx].meaningfulColumnOrder.filter(x => x.visibility===false)
    for(let i=0; i<hiddenColumnID.length; i++) {
      hiddenColumns.push(aTbl_getColumnName(hiddenColumnID[i].columnId).cn)
    }
    await nc_hideColumn(aTblSchema[idx].name, aTblSchema[idx].views[0].name, hiddenColumns)
  }
}

//////////  Data processing

// https://www.airtable.com/app1ivUy7ba82jOPn/api/docs#javascript/metadata
let Airtable = require('airtable');
let base = new Airtable({ apiKey: syncDB.airtable.apiKey }).base(
  syncDB.airtable.baseId
);

let aTblDataLinks = [];

function nocoLinkProcessing(table, record, field) {
  (async () => {

    let rec = record.fields;
    const refRowIdList = Object.values(rec);
    const referenceColumnName = Object.keys(rec)[0];

    if (refRowIdList.length) {
      for (let i = 0; i < refRowIdList[0].length; i++) {

        syncLog(`NC API: dbTableRow.nestedAdd ${record.id}/mm/${referenceColumnName}/${refRowIdList[0][i]}`)

        await api.dbTableRow.nestedAdd(
          'noco',
          syncDB.projectName,
          table.title,
          `${record.id}`,
          'mm', // fix me
          referenceColumnName,
          `${refRowIdList[0][i]}`
        );
      }
    }
  })().catch(e => {
    console.log(`NC: Link error`)
  });
}

// fix me:
// instead of skipping data after retrieval, use select fields option in airtable API
function nocoBaseDataProcessing(table, record) {
  (async () => {
    let rec = record.fields;

    // kludge -
    // trim spaces on either side of column name
    // leads to error in NocoDB
    Object.keys(rec).forEach(key => {
      let replacedKey = key.replace(/\?/g, 'QQ').trim()
      if (key !== replacedKey) {
        rec[replacedKey] = rec[key];
        delete rec[key];
      }
    });

    // post-processing on the record
    for (const [key, value] of Object.entries(rec)) {
      // retrieve datatype
      let dt = table.columns.find(x => x.title === key)?.uidt;

      // if(dt === undefined)
      //   console.log('fix me')

      // https://www.npmjs.com/package/validator
      // default value: digits_after_decimal: [2]
      // if currency, set decimal place to 2
      //
      if (dt === 'Currency') rec[key] = value.toFixed(2);

      // we will pick up LTAR once all table data's are in place
      if (dt === 'LinkToAnotherRecord') {
        aTblDataLinks.push(JSON.parse(JSON.stringify(rec)));
        delete rec[key];
      }

      // these will be automatically populated depending on schema configuration
      if (dt === 'Lookup') delete rec[key];
      if (dt === 'Rollup') delete rec[key];

      if (dt === 'Attachment') {
        let tempArr = [];
        for (const v of value) {
          const binaryImage = await axios
            .get(v.url, {
              responseType: 'stream',
              headers: {
                'Content-Type': v.type
              }
            })
            .then(response => {
              return response.data;
            })
            .catch(error => {
              console.log(error);
              return false;
            });

          var imageFile = new FormData();
          imageFile.append('files', binaryImage, {
            filename: v.filename
          });

          const rs = await axios
            .post(syncDB.baseURL + '/api/v1/db/storage/upload', imageFile, {
              params: {
                path: `noco/${syncDB.projectName}/${table.title}/${key}`
              },
              headers: {
                'Content-Type': `multipart/form-data; boundary=${imageFile._boundary}`,
                'xc-auth': syncDB.authToken
              }
            })
            .then(response => {
              return response.data;
            })
            .catch(e => {
              console.log(e);
            });

          tempArr.push(...rs);
        }
        rec[key] = JSON.stringify(tempArr);
      }
    }

    // insert airtable record ID explicitly into each records
    rec['record_id'] = record.id;

    // console.log(rec)

    syncLog(`NC API: dbTableRow.bulkCreate ${table.title} [${rec}]`)
    // console.log(JSON.stringify(rec, null, 2))

    // bulk Insert
    let returnValue = await api.dbTableRow.bulkCreate(
      'nc',
      syncDB.projectName,
      table.title,
      [rec]
    );

  })().catch(e => {
    console.log(`Record insert error`)
  });
}

async function nocoReadData(table, callback) {
  return new Promise((resolve, reject) => {
    base(table.title)
      .select({
        pageSize: 25,
        // maxRecords: 1,
      })
      .eachPage(
        function page(records, fetchNextPage) {
          // console.log(JSON.stringify(records, null, 2));

          // This function (`page`) will get called for each page of records.
          records.forEach(record => callback(table, record));

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            reject(err)
          }
          resolve()
        }
      );
  })
}


async function nocoReadDataSelected(table, callback, fields) {
  return new Promise((resolve, reject) => {

    base(table.title)
      .select({
        pageSize: 25,
        // maxRecords: 100,
        fields: [fields]
      })
      .eachPage(
        function page(records, fetchNextPage) {
          // console.log(JSON.stringify(records, null, 2));

          // This function (`page`) will get called for each page of records.
          // records.forEach(record => callback(table, record));
          for(let i=0; i<records.length; i++) {
            callback(table, records[i], fields)
          }

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.
          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            reject(err)
          }
          resolve()
        }
      );
  });
}

//////////
let ncCreatedProjectSchema = [];
let ncLinkMappingTable = [];

function nc_isLinkExists(atblFieldId) {
  if (
    ncLinkMappingTable.find(
      x => x.aTbl.typeOptions.symmetricColumnId === atblFieldId
    )
  )
    return true;
  return false;
}

async function nocoCreateProject() {
  syncLog(`Create Project: ${syncDB.projectName}`)

  // create empty project (XC-DB)
  ncCreatedProjectSchema = await api.project.create({
    // Enable to use aTbl identifiers as is: id: syncDB.airtable.baseId,
    title: syncDB.projectName
  });
}

// start function
async function nc_migrateATbl() {

  // fix me: delete project if already exists
  // remove later
  await init()

  // read schema file
  const schema = getAtableSchema();
  let aTblSchema = schema.tableSchemas;

  // create empty project
  await nocoCreateProject()

  // prepare table schema (base)
  await nocoCreateBaseSchema(aTblSchema);

  // add LTAR
  await nocoCreateLinkToAnotherRecord(aTblSchema);

  // add look-ups
  await nocoCreateLookups(aTblSchema);

  // add roll-ups
  await nocoCreateRollups(aTblSchema);

  // configure primary values
  await nocoSetPrimary(aTblSchema);

  // hide-fields
  await nocoReconfigureFields(aTblSchema);

  // await nc_DumpTableSchema();
  let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
  for (let i = 0; i < ncTblList.list.length; i++) {
    let ncTbl = await api.dbTable.read(ncTblList.list[i].id);
    await nocoReadData(ncTbl, nocoBaseDataProcessing);
  }

  // // Configure link @ Data row's
  for (let idx = 0; idx < ncLinkMappingTable.length; idx++) {
    let x = ncLinkMappingTable[idx];
    let ncTbl = await nc_getTableSchema(aTbl_getTableName(x.aTbl.tblId).tn);
    await nocoReadDataSelected(ncTbl, nocoLinkProcessing, x.aTbl.name);
  }
}

nc_migrateATbl().catch(e => {
  console.log(e?.config?.url);
});


