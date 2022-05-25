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
    'xc-auth': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfbjExdGk1Z2ZxNjBhbWEiLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTM0NTY5NzR9.Cva0SeSiLtDxT5RXvMEElok_IHNKQx3RlF5sYZf1nU0"
  }
}

const Api = require('nocodb-sdk').Api;
const api = new Api(ncConfig);

async function openProject(pName) {
  let pList = await api.project.list()
  let pId = pList.list.find(a => a.title === pName).id
  return await api.project.read(pId)
}

// let schemaCity = {
//   table
// }

(async() => {
  let project = await openProject("sample");
  let tblCity = await createProject()
})().catch(e => console.log(e))

