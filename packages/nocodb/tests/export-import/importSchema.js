const Api = require('nocodb-sdk').Api;
const { UITypes } = require('nocodb-sdk');
const jsonfile = require("jsonfile");

let api = {}
let ncIn = jsonfile.readFileSync('sample.json')
let ncProject = {}
let link = []
let lookup = []
let rollup = []
let formula = []
let ncTables = {}

const ncConfig = {
  projectName: "x2",
  baseURL: "http://localhost:8080",
  headers: {
    'xc-auth': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfazk0cTg3NGF6bTh5MngiLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTMzMTQ1MTZ9.h0YjZ9lLlIYYWQkgKWCoT5OuYNMfStuAjT_EwSasM6Q"
  }
}

async function createBaseTables() {
  for(let i=0; i<ncIn.length; i++) {
    let tblSchema = ncIn[i]
    let reducedColumnSet = tblSchema.columns.filter(a => a.uidt !== UITypes.LinkToAnotherRecord && a.uidt !== UITypes.Lookup && a.uidt !== UITypes.Rollup && a.uidt !== UITypes.Formula);
    link.push(...tblSchema.columns.filter(a => a.uidt === UITypes.LinkToAnotherRecord))
    lookup.push(...tblSchema.columns.filter(a => a.uidt === UITypes.Lookup))
    rollup.push(...tblSchema.columns.filter(a => a.uidt === UITypes.Rollup))
    formula.push(...tblSchema.columns.filter(a => a.uidt === UITypes.Formula))
    formula.map(a => a['table_id'] = tblSchema.id)

    let tbl = await api.dbTable.create(ncProject.id, {
      title: tblSchema.title,
      table_name: tblSchema.title,
      columns: reducedColumnSet.map(({id,...rest}) => ({...rest}))
    })
    ncTables[tbl.title] = tbl;
    ncTables[tbl.id] = tbl;
    ncTables[tblSchema.id] = tbl;
  }
}

let linksCreated = []
function isLinkCreated(pId, cId) {
  let idx = linksCreated.findIndex(a => a.cId === pId && a.pId === cId)
  if(idx === -1) {
    linksCreated.push({pId: pId, cId: cId})
    return false;
  }
  return true;
}

// retrieve nc-view column ID from corresponding nc-column ID
async function nc_getViewColumnId(viewId, viewType, ncColumnId) {
  // retrieve view Info
  let viewDetails;

  if (viewType === 'form')
    viewDetails = (await api.dbView.formRead(viewId)).columns;
  else if (viewType === 'gallery')
    viewDetails = (await api.dbView.galleryRead(viewId)).columns;
  else viewDetails = await api.dbView.gridColumnsList(viewId);

  return viewDetails.find(x => x.fk_column_id === ncColumnId)?.id;
}

async function createFormula() {
  for (let i = 0; i < formula.length; i++) {
    let tbl = await api.dbTableColumn.create(ncTables[formula[i].table_id].id, {
      uidt: UITypes.Formula,
      title: formula[i].title,
      formula_raw: formula[i].formula_raw
    });
  }
}

async function createLinks() {
  for (let i = 0; i < link.length; i++) {
    if (((link[i].colOptions.type === 'mm') &&
        (false === isLinkCreated(link[i].colOptions.fk_parent_column_id, link[i].colOptions.fk_child_column_id)))
      || (link[i].colOptions.type === 'hm')) {
      let srcTbl = ncTables[link[i].colOptions.fk_model_id];
      let dstTbl = ncTables[link[i].colOptions.fk_related_model_id];
      // create link
      let tbl = await api.dbTableColumn.create(srcTbl.id, {
        uidt: UITypes.LinkToAnotherRecord,
        title: link[i].title,
        parentId: srcTbl.id,
        childId: dstTbl.id,
        type: link[i].colOptions.type
      });
      ncTables[tbl.title] = tbl;
      ncTables[tbl.id] = tbl;
      ncTables[link[i].colOptions.fk_model_id] = tbl;

      let v2ColSchema = tbl.columns.find(x => x.title === link[i].title)

      // read related table again after link is created
      dstTbl = await api.dbTable.read(dstTbl.id);
      let v2SymmetricColumn = (link[i].colOptions.type === 'mm') ? dstTbl.columns.find(x => x.uidt === UITypes.LinkToAnotherRecord && x?.colOptions.fk_parent_column_id === v2ColSchema.colOptions.fk_child_column_id && x?.colOptions.fk_child_column_id === v2ColSchema.colOptions.fk_parent_column_id) :
        dstTbl.columns.find(x => x.uidt === UITypes.LinkToAnotherRecord && x?.colOptions.fk_parent_column_id === v2ColSchema.colOptions.fk_parent_column_id && x?.colOptions.fk_child_column_id === v2ColSchema.colOptions.fk_child_column_id)
      let v1SymmetricColumn = (link[i].colOptions.type === 'mm') ? link.find(x => x.colOptions.fk_parent_column_id === link[i].colOptions.fk_child_column_id && x.colOptions.fk_child_column_id === link[i].colOptions.fk_parent_column_id) :
        link.find(x => x.colOptions.fk_parent_column_id === link[i].colOptions.fk_parent_column_id && x.colOptions.fk_child_column_id === link[i].colOptions.fk_child_column_id);

      tbl = await api.dbTableColumn.update(v2SymmetricColumn.id, {
        ...v2SymmetricColumn,
        title: v1SymmetricColumn.title,
        column_name: null
      })
      ncTables[tbl.title] = tbl;
      ncTables[tbl.id] = tbl;
      ncTables[v1SymmetricColumn.colOptions.fk_model_id] = tbl;
    }
  }
}

function get_v2Id(v1ColId) {
  for(let i=0; i<ncIn.length; i++) {
    let tblSchema = ncIn[i]
    let colSchema = {}
    if(undefined !== (colSchema = tblSchema.columns.find(x => x.id === v1ColId))) {
      let colName = colSchema.title;
      let v2Tbl = ncTables[tblSchema.id];
      return v2Tbl.columns.find(y => y.title === colName)?.id
    }
  }
}

async function createLookup() {
  for(let i=0; i<lookup.length; i++) {
    let srcTbl = ncTables[lookup[i].colOptions.fk_model_id];
    let v2_fk_relation_column_id = get_v2Id(lookup[i].colOptions.fk_relation_column_id)
    let v2_lookup_column_id = get_v2Id(lookup[i].colOptions.fk_lookup_column_id)

    if(v2_lookup_column_id) {
      let tbl = await api.dbTableColumn.create(srcTbl.id, {
        uidt: UITypes.Lookup,
        title: lookup[i].title,
        fk_relation_column_id: v2_fk_relation_column_id,
        fk_lookup_column_id: v2_lookup_column_id
      });
      ncTables[tbl.title] = tbl;
      ncTables[tbl.id] = tbl;
      ncTables[lookup[i].colOptions.fk_model_id] = tbl;
    }
  }
}

async function createRollup() {
  for(let i=0; i<rollup.length; i++) {
    let srcTbl = ncTables[rollup[i].colOptions.fk_model_id];
    let v2_fk_relation_column_id = get_v2Id(rollup[i].colOptions.fk_relation_column_id)
    let v2_rollup_column_id = get_v2Id(rollup[i].colOptions.fk_rollup_column_id)

    if(v2_rollup_column_id) {
      let tbl = await api.dbTableColumn.create(srcTbl.id, {
        uidt: UITypes.Rollup,
        title: rollup[i].title,
        column_name: rollup[i].title,
        fk_relation_column_id: v2_fk_relation_column_id,
        fk_rollup_column_id: v2_rollup_column_id,
        rollup_function: rollup[i].colOptions.rollup_function
      });
      ncTables[tbl.title] = tbl;
      ncTables[tbl.id] = tbl;
      ncTables[rollup[i].colOptions.fk_model_id] = tbl;
    }
  }
}

async function configureGrid() {
  for(let i=0; i<ncIn.length; i++) {
    let tblSchema = ncIn[i];
    let tblId = ncTables[tblSchema.id].id;
    let gridList = tblSchema.views.filter(a => a.type === 3);
    let srcTbl = await api.dbTable.read(tblId);

    const view = await api.dbView.list(tblId);

    // create / rename view
    for(let gridCnt=0; gridCnt< gridList.length; gridCnt++) {
      let viewCreated = {}
      // rename first view; default view already created
      if(gridCnt === 0) {
        viewCreated = await api.dbView.update(view.list[0].id, {title: gridList[gridCnt].title});
      }
      // create new views
      else {
        viewCreated = await api.dbView.gridCreate(tblId, {title: gridList[gridCnt].title});
      }

      // column visibility
      for(let colCnt = 0; colCnt < gridList[gridCnt].columns.length; colCnt++) {
        let ncColumnId = srcTbl.columns.find(a => a.title === gridList[gridCnt].columns[colCnt].title)?.id
        let ncViewColumnId = await nc_getViewColumnId( viewCreated.id, "grid", ncColumnId )
        // column order & visibility
        await api.dbViewColumn.update(viewCreated.id, ncViewColumnId, {
          show: gridList[gridCnt].columns[colCnt].show,
          order: gridList[gridCnt].columns[colCnt].order,
        });
        await api.dbView.gridColumnUpdate(ncViewColumnId, {width: gridList[gridCnt].columns[colCnt].width})
      }
    }
  }
}

async function configureGallery() {
  for(let i=0; i<ncIn.length; i++) {
    let tblSchema = ncIn[i];
    let tblId = ncTables[tblSchema.id].id;
    let galleryList = tblSchema.views.filter(a => a.type === 2);
    for(let cnt=0; cnt< galleryList.length; cnt++) {
      const viewCreated = await api.dbView.galleryCreate(tblId, {title: galleryList[cnt].title});
    }
  }
}

async function configureForm() {
  for(let i=0; i<ncIn.length; i++) {
    let tblSchema = ncIn[i];
    let tblId = ncTables[tblSchema.id].id;
    let formList = tblSchema.views.filter(a => a.type === 1);
    let srcTbl = await api.dbTable.read(tblId);

    for(let formCnt=0; formCnt< formList.length; formCnt++) {
      const formData = {
        title: formList[formCnt].title,
        ...formList[formCnt].property
      };
      const viewCreated = await api.dbView.formCreate(tblId, formData);

      // column visibility
      for(let colCnt = 0; colCnt < formList[formCnt].columns.length; colCnt++) {
        let ncColumnId = srcTbl.columns.find(a => a.title === formList[formCnt].columns[colCnt].title)?.id
        let ncViewColumnId = await nc_getViewColumnId( viewCreated.id, "form", ncColumnId )
        // column order & visibility
        await api.dbView.formColumnUpdate(ncViewColumnId, {
          show: formList[formCnt].columns[colCnt].show,
          order: formList[formCnt].columns[colCnt].order,
          label: formList[formCnt].columns[colCnt].label,
          description: formList[formCnt].columns[colCnt].description,
          required: formList[formCnt].columns[colCnt].required,
        });
      }


    }
  }
}

async function importSchema() {
  api = new Api(ncConfig);

  const x = await api.project.list();
  const p = x.list.find(a => a.title === ncConfig.projectName);
  if (p) await api.project.delete(p.id);
  ncProject = await api.project.create({ title: ncConfig.projectName })
  await createBaseTables()
  await createLinks()
  await createLookup()
  await createRollup()
  await createFormula()

  // configure grid
  await configureGrid()

  // configure gallery
  await configureGallery()

  // configure form
  await configureForm()

}
(async() => {
  await importSchema()
  console.log('completed')
})().catch(e => console.log(e))