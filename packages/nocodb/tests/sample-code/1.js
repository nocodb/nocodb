/*

  1. Open existing project
  2. Create 2 tables
  3. Add a linked record field
  4. Insert records
    a) Normal data insert
    b) Link
  5. Clear records

*/

const ncConfig = {
  baseURL: "http://localhost:8080",
  headers: {
    'xc-auth': ""
  }
}

const Api = require('nocodb-sdk').Api;
const { UITypes } = require('nocodb-sdk');

const api = new Api(ncConfig);

async function openProject(pName) {
  let pList = await api.project.list()
  let pId = pList.list.find(a => a.title === pName).id
  return await api.project.read(pId)
}

async function createTable(pId, tSchema) {
  return await api.dbTable.create(pId, tSchema)
}

let schemaCity = {
  title: "City",
  table_name: "City",
  columns: [
    { title: "ID", column_name: "ID", uidt: "ID", pk: true },
    { title: "Title", column_name: "Title", uidt: "SingleLineText" }
  ]
};
let schemaCountry = {
  title: "Country",
  table_name: "Country",
  columns: [
    { title: "ID", column_name: "ID", uidt: "ID", pk: true },
    { title: "Title", column_name: "Title", uidt: "SingleLineText" }
  ]
};

async function init(pName) {
  // delete 'sample' project if already exists
  const x = await api.project.list();
  const p = x.list.find(a => a.title === pName);
  if (p) {
    await api.project.delete(p.id);
  }
  return await api.project.create({title: pName})
}

(async() => {
  // let project = await openProject("sample2");
  let project = await init("sample2")
  let tblCity = await createTable(project.id, schemaCity)
  let tblCountry = await createTable(project.id, schemaCountry)

  await api.dbTableColumn.create(tblCity.id, {
    title: "countryRead",
    uidt: UITypes.LinkToAnotherRecord,
    parentId: tblCity.id,
    childId: tblCountry.id,
    type: 'mm',
    onDelete: 'CASCADE'
  });

  await api.dbTableRow.bulkCreate("nc", project.id, tblCity.id, [{Title: "a1"}, {Title: "a2"}, {Title: "a3"}, {Title: "a4"}])
  await api.dbTableRow.bulkCreate("nc", project.id, tblCountry.id, [{Title: "b1"}, {Title: "b2"}, {Title: "b3"}, {Title: "b4"}])
  for (let i=1; i<=4; i++)
    await api.dbTableRow.nestedAdd("nc", project.id, tblCity.id, `${i}`, "mm", "countryRead", `${i}`);
  await api.dbTableRow.bulkDeleteAll("nc", project.id, tblCity.id, ["1", "2", "3", "4"])
  await api.dbTableRow.bulkDeleteAll("nc", project.id, tblCountry.id, ["1", "2", "3", "4"])

})().catch(e => console.log(e))

