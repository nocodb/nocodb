const Api = require('nocodb-sdk').Api;
const jsonfile = require('jsonfile');
const { UITypes } = require('nocodb-sdk');
const axios = require('axios').default;
const FormData = require('form-data');
const FetchAT = require('./fetchAT');

var base, baseId;

function syncLog(log) {
  // console.log(log)
}
const start = Date.now();

let enableErrorLogs = false
let process_aTblData = true
let generate_migrationStats = true
let aTblNcMappingTbl = {}
let migrationStats = []
let migrationStatsObj = {
  table_name: '',
  aTbl: {
    columns: 0,
    links: 0,
    lookup: 0,
    rollup: 0
  },
  nc: {
    columns: 0,
    links: 0,
    lookup: 0,
    rollup: 0,
    invalidColumn: 0
  }
}

// static mapping records between aTblId && ncId
async function addToMappingTbl(aTblId, ncId, ncName) {
  aTblNcMappingTbl[`${aTblId}`] = {
    ncId: ncId,

    // name added to assist in quick debug
    ncName: ncName
  }
}

function getNcIdFromAtId(aId) {
  return aTblNcMappingTbl[`aId`]?.ncId
}

function getNcNameFromAtId(aId) {
  return aTblNcMappingTbl[`aId`]?.ncName
}


// statistics
//
async function generateMigrationStats(aTblSchema) {

  for (let idx = 0; idx < aTblSchema.length; idx++) {
    migrationStatsObj.table_name = aTblSchema[idx].name

    let aTblLinkColumns = aTblSchema[idx].columns.filter(
      x => x.type === 'foreignKey'
    );
    let aTblLookups = aTblSchema[idx].columns.filter(
      x => x.type === 'lookup'
    );
    let aTblRollups = aTblSchema[idx].columns.filter(
      x => x.type === 'rollup'
    );

    let invalidColumnId = 0
    for(let i=0; i<aTblLookups.length; i++ ) {
      if(aTblLookups[i]?.typeOptions?.dependencies?.invalidColumnIds?.length) {
        invalidColumnId++
      }
    }
    for(let i=0; i<aTblRollups.length; i++ ) {
      if(aTblRollups[i]?.typeOptions?.dependencies?.invalidColumnIds?.length) {
        invalidColumnId++
      }
    }

    migrationStatsObj.aTbl.columns = aTblSchema[idx].columns.length;
    migrationStatsObj.aTbl.links = aTblLinkColumns.length;
    migrationStatsObj.aTbl.lookup = aTblLookups.length;
    migrationStatsObj.aTbl.rollup = aTblRollups.length;

    let ncTbl = await nc_getTableSchema(aTblSchema[idx].name);
    let linkColumn = ncTbl.columns.filter(
      x => x.uidt === 'LinkToAnotherRecord'
    );
    let lookup = ncTbl.columns.filter(
      x => x.uidt === 'Lookup'
    );
    let rollup = ncTbl.columns.filter(
      x => x.uidt === 'Rollup'
    );

    // all links hardwired as m2m. m2m generates additional tables per link
    // hence link/2
    migrationStatsObj.nc.columns = ncTbl.columns.length - linkColumn.length/2;
    migrationStatsObj.nc.links = linkColumn.length/2;
    migrationStatsObj.nc.lookup = lookup.length;
    migrationStatsObj.nc.rollup = rollup.length;
    migrationStatsObj.nc.invalidColumn = invalidColumnId;

    let temp = JSON.parse(JSON.stringify(migrationStatsObj))
    migrationStats.push(temp)
  }

  const columnSum = migrationStats.reduce((accumulator, object) => {
    return accumulator + object.nc.columns;
  }, 0);
  const linkSum = migrationStats.reduce((accumulator, object) => {
    return accumulator + object.nc.links;
  }, 0);
  const lookupSum = migrationStats.reduce((accumulator, object) => {
    return accumulator + object.nc.lookup;
  }, 0);
  const rollupSum = migrationStats.reduce((accumulator, object) => {
    return accumulator + object.nc.rollup;
  }, 0);

  console.log(`Quick Status:`)
  console.log(`     Total Tables:   ${aTblSchema.length}`)
  console.log(`     Total Columns:  ${columnSum}`)
  console.log(`       Links:        ${linkSum}`)
  console.log(`       Lookup:       ${lookupSum}`)
  console.log(`       Rollup:       ${rollupSum}`)

  const duration = Date.now() - start;
  console.log(`Migration time: ${duration}`)

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

async function getAtableSchema() {
  // let file = jsonfile.readFileSync('./t0v0.json');
  let ft = await FetchAT(syncDB.airtable.shareId);
  let file = ft.schema;
  baseId = ft.baseId;
  base = new Airtable({ apiKey: syncDB.airtable.apiKey }).base(
    baseId
  );
  // store copy of atbl schema globally
  aTblSchema = file.tableSchemas;
  return file;
}

async function getViewData(tblId, viewId) {
  let ft = await FetchAT(syncDB.airtable.shareId, tblId, viewId);
  return ft.schema?.tableDatas[0]?.viewDatas[0]
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

    // insert _aTbl_nc_rec_id of type ID by default
    table.columns = [
      {
        title: '_aTbl_nc_rec_id',
        column_name: '_aTbl_nc_rec_id',
        // uidt: UITypes.ID
        uidt: UITypes.SingleLineText,
        pk: true,
      }
    ];

    for (let j = 0; j < tblSchema[i].columns.length; j++) {
      let col = tblSchema[i].columns[j];

      // skip link, lookup, rollup fields in this iteration
      if (['foreignKey', 'lookup', 'rollup'].includes(col.type)) {
        continue;
      }

      // not supported datatype
      // if (['formula'].includes(col.type)) continue;

      // base column schema
      // kludge: error observed in Nc with space around column-name
      let ncCol = {
        // Enable to use aTbl identifiers as is: id: col.id,
        title: col.name.trim(),

        // knex complains use of '?' in field name
        // good to replace all special characters by _ in one go
        column_name: col.name.replace(/\?/g, 'QQ').replace('.', '_').trim(),
        uidt: getNocoType(col)
      };

      // check if already a column exists with same name?
      let duplicateColumn = table.columns.find(x => x.title === col.name.trim())
      if(duplicateColumn) {
        if(enableErrorLogs) console.log(`## Duplicate ${ncCol.title}`)

        ncCol.title = ncCol.title + '_2'
        ncCol.column_name = ncCol.column_name + '_2'
      }

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

  console.log(`Total tables: ${tables.length} `)

  // for each table schema, create nc table
  for (let idx = 0; idx < tables.length; idx++) {

    console.log(`Phase-1 [${String(idx+1).padStart(2, '0')}/${tables.length}] Creating base table schema: ${tables[idx].title}`)

    syncLog(`NC API: dbTable.create ${tables[idx].title}`)
    let table = await api.dbTable.create(
      ncCreatedProjectSchema.id,
      tables[idx]
    );

    // update mapping table
    await addToMappingTbl(aTblSchema[idx].id, table.id, table.title)
    for(let colIdx=0; colIdx<table.columns.length; colIdx++){
      let aId = aTblSchema[idx].columns.find(x => x.name.trim() === table.columns[colIdx].title)?.id
      if(aId)
        await addToMappingTbl(aId, table.columns[colIdx].id, table.columns[colIdx].title)
    }

    // update default view name- to match it to airtable view name
    syncLog(`NC API: dbView.list ${table.id}`)
    let view = await api.dbView.list(table.id);

    syncLog(`NC API: dbView.update ${view.list[0].id} ${aTblSchema[idx].views[0].name}`)
    let aTbl_grid = aTblSchema[idx].views.find(x => x.type === 'grid')
    let x = await api.dbView.update(view.list[0].id, {title: aTbl_grid.name})

    await addToMappingTbl(aTbl_grid.id, table.views[0].id, aTbl_grid.name)
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
        console.log(`Phase-2 [${String(idx+1).padStart(2, '0')}/${aTblSchema.length}] Configuring Links :: [${String(i+1).padStart(2, '0')}/${aTblLinkColumns.length}] ${aTblSchema[idx].name}`)

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

          // check if already a column exists with this name?
          let srcTbl = await api.dbTable.read(srcTableId)
          let duplicate = srcTbl.columns.find(x => x.title === aTblLinkColumns[i].name)
          let suffix = duplicate?'_2':'';
          if(duplicate)
            if(enableErrorLogs) console.log(`## Duplicate ${aTblLinkColumns[i].name}`)

          // create link
          let ncTbl = await api.dbTableColumn.create(srcTableId, {
            uidt: 'LinkToAnotherRecord',
            title: aTblLinkColumns[i].name + suffix,
            parentId: srcTableId,
            childId: childTableId,
            type: 'mm'
              // aTblLinkColumns[i].typeOptions.relationship === 'many'
              //   ? 'mm'
              //   : 'hm'
          });
          syncLog(`NC API: dbTableColumn.create LinkToAnotherRecord`)

          let ncId = ncTbl.columns.find(x => x.title === aTblLinkColumns[i].name + suffix)?.id
          await addToMappingTbl(aTblLinkColumns[i].id, ncId, aTblLinkColumns[i].name + suffix)

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

          // hack // fix me
          if(parentLinkColumn.uidt !== 'LinkToAnotherRecord') {
            parentLinkColumn = parentTblSchema.columns.find(
              col => col.title === (ncLinkMappingTable[x].nc.title + '_2')
            );
          }

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

          // check if already a column exists with this name?
          let duplicate = childTblSchema.columns.find(x => x.title === aTblLinkColumns[i].name)
          let suffix = duplicate?'_2':'';
          if(duplicate)
            if(enableErrorLogs) console.log(`## Duplicate ${aTblLinkColumns[i].name}`)

          // rename
          // note that: current rename API requires us to send all parameters,
          // not just title being renamed
          let ncTbl = await api.dbTableColumn.update(childLinkColumn.id, {
            ...childLinkColumn,
            title: aTblLinkColumns[i].name + suffix,
          });

          let ncId = ncTbl.columns.find(x => x.title === aTblLinkColumns[i].name + suffix)?.id
          await addToMappingTbl(aTblLinkColumns[i].id, ncId, aTblLinkColumns[i].name + suffix)

          // console.log(res.columns.find(x => x.title === aTblLinkColumns[i].name))
          syncLog(`NC API: dbTableColumn.update rename symmetric column`)
        }
      }
    }
  }
}

let nestedLookupTbl = []

async function nocoCreateLookups(aTblSchema) {
  // LookUps
  for (let idx = 0; idx < aTblSchema.length; idx++) {

    let aTblColumns = aTblSchema[idx].columns.filter(x => x.type === 'lookup');

    // parent table ID
    let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;

    if (aTblColumns.length) {
      // Lookup
      for (let i = 0; i < aTblColumns.length; i++) {
        console.log(`Phase-3 [${String(idx+1).padStart(2, '0')}/${aTblSchema.length}] Configuring Lookup :: [${String(i+1).padStart(2, '0')}/${aTblColumns.length}] ${aTblSchema[idx].name}`)

        // something is not right, skip
        if(aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds?.length) {
          if(enableErrorLogs) console.log(`## Invalid column IDs mapped; skip`)
          continue
        }

        // let ncRelationColumn = await nc_getColumnSchema(
        //   aTblColumns[i].typeOptions.relationColumnId
        // );
        // let ncLookupColumn = await nc_getColumnSchema(
        //   aTblColumns[i].typeOptions.foreignTableRollupColumnId
        // );
        //
        // if(ncLookupColumn === undefined) {
        //   aTblColumns[i]['srcTableId'] = srcTableId;
        //   nestedLookupTbl.push(aTblColumns[i])
        //   continue;
        // }

        let ncRelationColumnId = getNcIdFromAtId(aTblColumns[i].typeOptions.relationColumnId);
        let ncLookupColumnId = getNcIdFromAtId(aTblColumns[i].typeOptions.foreignTableRollupColumnId);

        if (ncLookupColumnId === undefined) {
          aTblColumns[i]['srcTableId'] = srcTableId;
          nestedLookupTbl.push(aTblColumns[i])
          continue;
        }


        let lookupColumn = await api.dbTableColumn.create(srcTableId, {
          uidt: 'Lookup',
          title: aTblColumns[i].name,
          fk_relation_column_id: ncRelationColumnId,
          fk_lookup_column_id: ncLookupColumnId
        });

        let ncId = lookupColumn.columns.find(x => x.title === aTblColumns[i].name)?.id
        await addToMappingTbl(aTblColumns[i].id, ncId, aTblColumns[i].name)

        syncLog(`NC API: dbTableColumn.create LOOKUP`)
      }
    }
  }

  let level = 2
  let nestedCnt = 0
  while(nestedLookupTbl.length) {

    // if nothing has changed from previous iteration, skip rest
    if(nestedCnt === nestedLookupTbl.length) {
      if(enableErrorLogs)
        console.log(`## Failed to configure ${nestedLookupTbl.length} lookups`)
      break;
    }

    // Nested lookup
    nestedCnt = nestedLookupTbl.length
    for (let i = 0; i < nestedLookupTbl.length; i++) {
      console.log(`Phase-4 Configuring Nested Lookup: Level-${level} [${i+1}/${nestedCnt}]`)

      let srcTableId = nestedLookupTbl[i].srcTableId;

      // let ncRelationColumn = await nc_getColumnSchema(
      //   nestedLookupTbl[i].typeOptions.relationColumnId
      // );
      // let ncLookupColumn = await nc_getColumnSchema(
      //   nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId
      // );
      //
      // if (ncLookupColumn === undefined) {
      //   continue;
      // }

      let ncRelationColumnId = getNcIdFromAtId(nestedLookupTbl[i].typeOptions.relationColumnId);
      let ncLookupColumnId = getNcIdFromAtId(nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId);

      if (ncLookupColumnId === undefined) {
        continue;
      }

      let lookupColumn = await api.dbTableColumn.create(srcTableId, {
        uidt: 'Lookup',
        title: nestedLookupTbl[i].name,
        fk_relation_column_id: ncRelationColumnId,
        fk_lookup_column_id: ncLookupColumnId
      });

      let ncId = lookupColumn.columns.find(x => x.title === aTblColumns[i].name)?.id
      await addToMappingTbl(aTblColumns[i].id, ncId, aTblColumns[i].name)

      // remove entry
      nestedLookupTbl.splice(i, 1)
      syncLog(`NC API: dbTableColumn.create LOOKUP`)
    }
    level++
  }
}

let nestedRollupTbl = []
async function nocoCreateRollups(aTblSchema) {
  // Rollups
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let aTblColumns = aTblSchema[idx].columns.filter(x => x.type === 'rollup');

    // parent table ID
    let srcTableId = (await nc_getTableSchema(aTblSchema[idx].name)).id;

    if (aTblColumns.length) {
      // rollup exist
      for (let i = 0; i < aTblColumns.length; i++) {
        console.log(`Phase-5 [${String(idx+1).padStart(2, '0')}/${aTblSchema.length}] Configuring Rollup :: [${String(i+1).padStart(2, '0')}/${aTblColumns.length}] ${aTblSchema[idx].name}`)

        // something is not right, skip
        if(aTblColumns[i]?.typeOptions?.dependencies?.invalidColumnIds?.length) {
          if(enableErrorLogs) console.log(`## Invalid column IDs mapped; skip`)
          continue
        }

        // let ncRelationColumn = await nc_getColumnSchema(
        //   aTblColumns[i].typeOptions.relationColumnId
        // );
        // let ncRollupColumn = await nc_getColumnSchema(
        //   aTblColumns[i].typeOptions.foreignTableRollupColumnId
        // );
        //
        // if(ncRollupColumn === undefined) {
        //   aTblColumns[i]['srcTableId'] = srcTableId;
        //   nestedRollupTbl.push(aTblColumns[i])
        //   continue;
        // }

        let ncRelationColumnId = getNcIdFromAtId(aTblColumns[i].typeOptions.relationColumnId)
        let ncRollupColumnId = getNcIdFromAtId(aTblColumns[i].typeOptions.foreignTableRollupColumnId)

        if (ncRollupColumnId === undefined) {
          aTblColumns[i]['srcTableId'] = srcTableId;
          nestedRollupTbl.push(aTblColumns[i])
          continue;
        }

        let rollupColumn = await api.dbTableColumn.create(srcTableId, {
          uidt: 'Rollup',
          title: aTblColumns[i].name,
          fk_relation_column_id: ncRelationColumnId,
          fk_rollup_column_id: ncRollupColumnId,
          rollup_function: 'sum' // fix me: hardwired
        });
        syncLog(`NC API: dbTableColumn.create ROLLUP`)

        let ncId = rollupColumn.columns.find(x => x.title === aTblColumns[i].name)?.id
        await addToMappingTbl(aTblColumns[i].id, ncId, aTblColumns[i].name)

      }
    }
  }
  console.log(`Nested rollup: ${nestedRollupTbl.length}`)
}

async function nocoLookupForRollups() {
  let nestedCnt = nestedLookupTbl.length
  for (let i = 0; i < nestedLookupTbl.length; i++) {
    console.log(`Phase-6 Configuring Lookup over Rollup :: [${i+1}/${nestedCnt}]`)

    let srcTableId = nestedLookupTbl[i].srcTableId;

    // let ncRelationColumn = await nc_getColumnSchema(
    //   nestedLookupTbl[i].typeOptions.relationColumnId
    // );
    // let ncLookupColumn = await nc_getColumnSchema(
    //   nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId
    // );

    let ncRelationColumnId = getNcIdFromAtId(nestedLookupTbl[i].typeOptions.relationColumnId)
    let ncLookupColumnId = getNcIdFromAtId(nestedLookupTbl[i].typeOptions.foreignTableRollupColumnId)

    if (ncLookupColumnId === undefined) {
      continue;
    }

    let lookupColumn = await api.dbTableColumn.create(srcTableId, {
      uidt: 'Lookup',
      title: nestedLookupTbl[i].name,
      fk_relation_column_id: ncRelationColumnId,
      fk_lookup_column_id: ncLookupColumnId
    });

    // remove entry
    nestedLookupTbl.splice(i, 1)
    syncLog(`NC API: dbTableColumn.create LOOKUP`)

    let ncId = lookupColumn.columns.find(x => x.title === nestedLookupTbl[i].name)?.id
    await addToMappingTbl(nestedLookupTbl[i].id, ncId, nestedLookupTbl[i].name)
  }
}

async function nocoSetPrimary(aTblSchema) {
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    console.log(`Phase-7 [${String(idx+1).padStart(2, '0')}/${aTblSchema.length}] Configuring Primary value : ${aTblSchema[idx].name}`)

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

  for(let i =0; i<columnName.length; i++) {
    // retrieve column schema
    let ncColumn = ncTbl.columns.find(x => x.title === columnName[i]);
    // retrieve view column ID
    let viewColumnId = viewDetails.find(x => x.fk_column_id === ncColumn?.id)?.id

    // fix me
    if(viewColumnId === undefined) {
      if(enableErrorLogs) console.log(`## Column disable fail: ${tblName}, ${viewName}, ${columnName[i]}`)
      continue;
    }

    // hide
    syncLog(`NC API: dbViewColumn.update ${viewId}, ${ncColumn.id}`)
    let retVal = await api.dbViewColumn.update(viewId, viewColumnId, { show: false })
  }
}

async function nocoReconfigureFields(aTblSchema) {
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let hiddenColumns = ["_aTbl_nc_rec_id"]

    // extract other columns hidden in this view
    let hiddenColumnID = aTblSchema[idx].meaningfulColumnOrder.filter(x => x.visibility===false)
    for(let i=0; i<hiddenColumnID.length; i++) {
      hiddenColumns.push(aTbl_getColumnName(hiddenColumnID[i].columnId).cn)
    }
    console.log(`Phase-8 [${String(idx+1).padStart(2, '0')}/${aTblSchema.length}] Hide columns [${idx+1}/${aTblSchema.length}] ${aTblSchema[idx].name}`)

    let aTbl_viewname = aTblSchema[idx].views.find(x => x.type === 'grid').name
    await nc_hideColumn(aTblSchema[idx].name, aTbl_viewname, hiddenColumns)
  }
}

//////////  Data processing

// https://www.airtable.com/app1ivUy7ba82jOPn/api/docs#javascript/metadata
let Airtable = require('airtable');

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
          table.id,
          `${record.id}`,
          'mm', // fix me
          encodeURIComponent(referenceColumnName),
          `${refRowIdList[0][i]}`
        );
      }
    }
  })().catch(e => {
    console.log(e)
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
      // if (dt === 'Attachment') delete rec[key];

      if (dt === 'Collaborator') {
        rec[key] = `${value?.name} <${value?.email}>`
      }

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
            filename: v.filename.includes('?')?v.filename.split('?')[0]:v.filename
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
    rec['_aTbl_nc_rec_id'] = record.id;

    // console.log(rec)

    syncLog(`NC API: dbTableRow.bulkCreate ${table.title} [${rec}]`)
    // console.log(JSON.stringify(rec, null, 2))

    // bulk Insert
    let returnValue = await api.dbTableRow.bulkCreate(
      'nc',
      syncDB.projectName,
      table.id, // encodeURIComponent(table.title),
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

async function nocoConfigureGridView(aTblSchema) {
  for (let idx = 0; idx < aTblSchema.length; idx++) {
    let tblId = (await nc_getTableSchema(aTblSchema[idx].name)).id;
    let gridViews = aTblSchema[idx].views.filter(x => x.type === 'grid');

    for(let i=0; i<gridViews.length; i++) {

      // fetch viewData JSON
      let vData = await getViewData(aTblSchema[idx].id, gridViews[i].id)

      // retrieve view name & associated NC-ID
      let viewName = aTblSchema[idx].views.find(x => x.id === gridViews[i].id)?.name
      let viewList = await api.dbView.list(tblId)
      let ncViewId = viewList?.list?.find(x => x.tn === viewName)?.id

      // create view (default already created)
      if (i > 0) {
        let viewCreated = await api.dbView.gridCreate(tblId, { title: viewName })
        await addToMappingTbl(gridViews[i].id, viewCreated.id, viewName)
      }

      // hide fields
      let hiddenColumns = ["_aTbl_nc_rec_id"]
      // extract other columns hidden in this view
      let hiddenColumnID = vData.columnOrder.filter(x => x.visibility===false)
      for(let j=0; j<hiddenColumnID.length; j++) {
        hiddenColumns.push(aTbl_getColumnName(hiddenColumnID[j].columnId).cn)
      }
      // console.log(`Phase-8 [${String(idx+1).padStart(2, '0')}/${aTblSchema.length}] Hide columns [${idx+1}/${aTblSchema.length}] ${aTblSchema[idx].name}`)
      await nc_hideColumn(aTblSchema[idx].name, viewName, hiddenColumns)

      ////////////////////////////////////

      // configure sort
      if(vData?.filters) {

        // skip filters if nested
        if(!vData.filters.filterSet.find(x => x?.type === 'nested')) {

          console.log(vData?.filters)
        }
      }

      // configure filter
      if(vData?.lastSortsApplied?.sortSet.length) {
        for(let i=0; i<vData.lastSortsApplied.sortSet.length; i++) {
          let columnId = (await nc_getColumnSchema(vData.lastSortsApplied.sortSet[i].columnId)).id

          await api.dbTableSort.create(ncViewId, {
            fk_column_id: columnId,
            direction: vData.lastSortsApplied.sortSet[i].ascending?'asc':'dsc'
          })
        }
      }
    }

  }


}

// start function
async function nc_migrateATbl() {

  // fix me: delete project if already exists
  // remove later
  await init()

  // read schema file
  const schema = await getAtableSchema();
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

  // lookups for rollups
  await nocoLookupForRollups()

  // configure primary values
  await nocoSetPrimary(aTblSchema);

  // hide-fields
  await nocoReconfigureFields(aTblSchema);

  // configure grid views
  await nocoConfigureGridView(aTblSchema)

  if(process_aTblData) {
    // await nc_DumpTableSchema();
    let ncTblList = await api.dbTable.list(ncCreatedProjectSchema.id);
    for (let i = 0; i < ncTblList.list.length; i++) {
      let ncTbl = await api.dbTable.read(ncTblList.list[i].id);
      await nocoReadData(ncTbl, nocoBaseDataProcessing);
    }

    // Configure link @ Data row's
    for (let idx = 0; idx < ncLinkMappingTable.length; idx++) {
      let x = ncLinkMappingTable[idx];
      let ncTbl = await nc_getTableSchema(aTbl_getTableName(x.aTbl.tblId).tn);
      await nocoReadDataSelected(ncTbl, nocoLinkProcessing, x.aTbl.name);
    }
  }

  if(generate_migrationStats) {
    await generateMigrationStats(aTblSchema)
  }

  // let ncId = (await nc_getTableSchema(aTblSchema[0].name)).id
  // let ncTbl = await api.dbTable.read(ncId)
  // console.log(ncTbl)
  // console.log(aTblNcMappingTbl)
  // console.log(Object.keys(aTblNcMappingTbl).length)
}

nc_migrateATbl().catch(e => {
  // console.log(e?.config?.url);
  console.log(e)
});


