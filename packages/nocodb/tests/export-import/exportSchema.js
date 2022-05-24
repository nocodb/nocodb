const Api = require('nocodb-sdk').Api;
const { UITypes } = require('nocodb-sdk');
const jsonfile = require("jsonfile");

let ncMap = {}
let tblSchema = []
let api = {}
let viewStore = {columns: {}, sort: {}, filter: {}}

const ncConfig = {
  projectName: "sample",
  baseURL: "http://localhost:8080",
  headers: {
    'xc-auth': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfazk0cTg3NGF6bTh5MngiLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTMzMTQ1MTZ9.h0YjZ9lLlIYYWQkgKWCoT5OuYNMfStuAjT_EwSasM6Q"
  }
}

// helper routines
// remove objects containing 0/ false/ null
// fixme: how to handle when cdf (default value) is configured as 0/ null/ false
function removeEmpty(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => ((v != null) && (v != 0) && (v != false)))
      .map(([k, v]) => [k, v === Object(v) ? removeEmpty(v) : v])
  );
}

// let linksAdded = []
// function isLinkExists(pId, cId) {
//   let idx = linksAdded.findIndex(a => a.child === pId && a.parent === cId)
//   if(idx === -1) {
//     linksAdded.push({ child: cId, parent: pId })
//     return false;
//   }
//   return true;
// }

function ncGetColData(cId) {

}

function addColumnSpecificData(c) {
  // pick required fields to proceed further
  let col = removeEmpty((({ id, title, column_name, uidt, dt, pk, pv, rqd, dtxp, system }) =>
    ({ id, title, column_name, uidt, dt, pk, pv, rqd, dtxp, system }))(c))

  let colOptions = null
  switch(c.uidt) {
    case UITypes.Formula:
      colOptions = {
        formula: c.colOptions.formula,
        formula_raw: c.colOptions.formula_raw
      }
      break
    case UITypes.LinkToAnotherRecord:
      colOptions = {
        fk_model_id: c.fk_model_id,
        fk_related_model_id: c.colOptions.fk_related_model_id,
        fk_child_column_id: c.colOptions.fk_child_column_id,
        fk_parent_column_id: c.colOptions.fk_parent_column_id,
        type: c.colOptions.type
      }
      break;
    case UITypes.Lookup:
      colOptions = {
        fk_model_id: c.fk_model_id,
        fk_relation_column_id: c.colOptions.fk_relation_column_id,
        fk_lookup_column_id: c.colOptions.fk_lookup_column_id,
      }
      break;
    case UITypes.Rollup:
      colOptions = {
        fk_model_id: c.fk_model_id,
        fk_relation_column_id: c.colOptions.fk_relation_column_id,
        fk_rollup_column_id: c.colOptions.fk_rollup_column_id,
        rollup_function: c.colOptions.rollup_function
      }
      break;
  }

  // colOptions not required for formula
  if (c.uidt === UITypes.Formula) {
    col.formula = c.colOptions.formula;
    col.formula_raw = c.colOptions.formula_raw;
  }
  else if(colOptions) col[`colOptions`] = colOptions;
  return col;
}

function addViewDetails(v) {
  // pick required fields to proceed further
  let view = (({ id, title, type, show_system_fields, lock_type, order }) => (
    { id, title, type, show_system_fields, lock_type, order }))(v);

  // form view
  if(v.type === 1) {
    view.property = (({ heading, subheading, success_msg, redirect_after_secs, email, submit_another_form, show_blank_form }) => (
      { heading, subheading, success_msg, redirect_after_secs, email, submit_another_form, show_blank_form }))(v.view);
  }

  // gallery view
  else if (v.type === 2) {
    view.property = {fk_cover_image_col_id: ncMap[v.view.fk_cover_image_col_id]}
  }

  // gallery view doesn't share column information in api yet
  if(v.type !== 2) {
    if(v.type === 3)
    view.columns = viewStore.columns[v.id].map(a => (({ id, width, order, show }) => (
      { id, width, order, show }))(a))
    if(v.type === 1)
      view.columns = viewStore.columns[v.id].map(a => (({ id, order, show, label, help, description, required }) => (
        { id, order, show, label, help, description, required }))(a))

    for (let i = 0; i < view.columns?.length; i++)
      view.columns[i].title = ncMap[viewStore.columns[v.id][i].id]

    view.columns = view.columns.filter(a => a.title.includes('_nc_m2m_') === false)
  }

  // filter & sort configurations
  if(v.type !== 1) {
    // view.sort = viewStore.sort[v.id].map(a => (({ id, order, show, label, help, description, required }) => (
    //   { id, order, show, label, help, description, required }))(a))
  }
  return view;
}

// view data stored as is for quick access
async function storeViewDetails(tableId) {
  // read view data for each table
  let viewList = await api.dbView.list(tableId)
  for(let j=0; j<viewList.list.length; j++) {
    let v = viewList.list[j]
    let viewDetails = []

    // invoke view specific read to populate columns information
    if (v.type === 1) viewDetails = (await api.dbView.formRead(v.id)).columns;
    else if (v.type === 2) viewDetails = await api.dbView.galleryRead(v.id);
    else if (v.type === 3) viewDetails = await api.dbView.gridColumnsList(v.id);
    viewStore.columns[v.id] = viewDetails;

    // populate sort information
    let vSort = await api.dbTableSort.list(v.id);
    viewStore.sort[v.id] = vSort.sorts.list

    let vFilter = await api.dbTableFilter.read(v.id)
    viewStore.filter[v.id] = vFilter
  }
}

// mapping table for quick information access
// store maps for tableId, columnId, viewColumnId & viewId to their names
async function generateMapTbl(pId) {
  const tblList = await api.dbTable.list(pId)

  for(let i=0; i<tblList.list.length; i++) {
    let tblId = tblList.list[i].id
    let tbl = await api.dbTable.read(tblId)

    // table ID <> name
    ncMap[tblId] = tbl.title;

    // column ID <> name
    tbl.columns.map(x => ncMap[x.id] = x.title )

    // view ID <> name
    tbl.views.map(x => ncMap[x.id] = x.tn )

    for(let i=0; i<tbl.views.length; i++) {
      let x = tbl.views[i]
      let viewColumns = []
      if (x.type === 1) viewColumns = (await api.dbView.formRead(x.id)).columns;
      else if (x.type === 2) viewColumns = (await api.dbView.galleryRead(x.id)).columns;
      else viewColumns = await api.dbView.gridColumnsList(x.id);

      // view column ID <> name
      viewColumns?.map(a => ncMap[a.id] = ncMap[a.fk_column_id])
    }
  }
}

// main
//
async function exportSchema() {
  api = new Api( ncConfig );

  // fetch project details (id et.al)
  const x = await api.project.list();
  const p = x.list.find(a => a.title === ncConfig.projectName);

  await generateMapTbl(p.id)

  // read project
  const tblList = await api.dbTable.list(p.id)
  for(let i=0; i<tblList.list.length; i++) {
    let tblId = tblList.list[i].id
    await storeViewDetails(tblId)

    let tbl = await api.dbTable.read(tblId)

    // prepare schema
    let tSchema = {
      id: tbl.id,
      title: tbl.title,
      table_name: tbl?.table_name,
      columns: [...tbl.columns.map(c => addColumnSpecificData(c))]
        .filter(a => a.title.includes('_nc_m2m_') === false)
        .filter(a => !(a?.system===1 && a.uidt===UITypes.LinkToAnotherRecord )),
      views: [...tbl.views.map(v => addViewDetails(v))]
    }
    tblSchema.push(tSchema)
  }
}

(async() => {
  await exportSchema()
  jsonfile.writeFileSync(`${ncConfig.projectName.replace(/ /g, '_')}.json`, tblSchema, { spaces: 2 })
})().catch(e => {console.log(e)})
