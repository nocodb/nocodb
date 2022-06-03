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
    'xc-auth': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfZ3RvN28zOXkwaWcyZDYiLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTQyNjE4NTN9.P1j670xZSHFNAL3FkoezAEerw4IZQbL5X8f1XAFveMc"
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
  let project = await init("sample")
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

  await api.dbTableColumn.create(tblCountry.id, {
    title: "cityList",
    uidt: UITypes.LinkToAnotherRecord,
    parentId: tblCountry.id,
    childId: tblCity.id,
    type: 'hm'
  });

  let cityRecords = []
  for (let i=0; i<1000; i++)
    cityRecords.push({Title: `city_${i}`})

  await api.dbTableRow.bulkCreate("nc", project.id, tblCity.id, cityRecords)
  await api.dbTableRow.bulkCreate("nc", project.id, tblCountry.id, [{Title: "b1"}, {Title: "b2"}])
  for (let i=1; i<=1000; i++)
    await api.dbTableRow.nestedAdd("nc", project.id, tblCity.id, `${i}`, "mm", "countryRead", `1`);
  for (let i=1; i<=1000; i++)
    await api.dbTableRow.nestedAdd("nc", project.id, tblCountry.id, `1`, "mm", "cityList", `${i}`);
  // await api.dbTableRow.bulkDeleteAll("nc", project.id, tblCity.id, ["1", "2", "3", "4"])
  // await api.dbTableRow.bulkDeleteAll("nc", project.id, tblCountry.id, ["1", "2", "3", "4"])

})().catch(e => console.log(e))

