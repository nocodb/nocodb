const { UITypes } = require("nocodb-sdk");
const Api = require('nocodb-sdk').Api;

const syncDB = {
  airtable: {
    apiKey: 'keyeZla3k0desT8fU',
    baseId: 'appgnPOzfhmB1ZPL9',
    schemaJson: './content-calendar.json'
  },
  projectName: 'sample',
  baseURL: 'http://localhost:8080',
  authToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAbm9jb2RiLmNvbSIsImZpcnN0bmFtZSI6bnVsbCwibGFzdG5hbWUiOm51bGwsImlkIjoidXNfOGtwZ3lqd3lzcGEwN3giLCJyb2xlcyI6InVzZXIsc3VwZXIiLCJpYXQiOjE2NTEwNTIzNzl9.QjK4-w1u_ZYaRAjmCD_0YBZyHerMm08LcRp0oheGAIw'
};

// const apiSignUp = new Api({
//   baseURL: syncDB.baseURL,
// });

let api;


async function init() {
  // delete 'sample' project if already exists
  let x = await api.project.list()

  console.log(x)

  let sampleProj = x.list.find(a => a.title === 'sample')
  if(sampleProj) {
    await api.project.delete(sampleProj.id)
  }
}

(async () => {
  api = new Api({
    baseURL: syncDB.baseURL,
  });
  let auth = await api.auth.signup({email: 'user@nocodb.com', password: 'Password123.'})

  api = new Api({
    baseURL: syncDB.baseURL,
    headers: {
      'xc-auth': auth.token
    }
  });

  let ncCreatedProjectSchema = await api.project.create({
    title: syncDB.projectName
  });

  let tableSchema = {
    table_name: 'sample',
    title: 'sample',
    columns: [
      {
        title: 'record_id',
        column_name: 'record_id',
        uidt: UITypes.ID
      },
      {
        title: 'Title',
        column_name: 'Title',
        uidt: UITypes.SingleLineText
      },
      {
        title: 'Attach',
        column_name: 'Attach',
        uidt: UITypes.Attachment
      }
    ]
  };

  let table = await api.dbTable.create(
    ncCreatedProjectSchema.id,
    tableSchema
  );

  let rec = [
    {Title: 'test-1'},
    {Title: 'test-2'},
    {Title: 'test-3'}
  ]

  // bulk Insert
  let returnValue = await api.dbTableRow.bulkCreate(
    'nc',
    'sample',
    'sample',
    rec
  );

  let rVal = await api.storage.upload(
    {
      path: ['noco', 'sample', 'sample', 'Attach'].join('/')
    }, {
      files: './ltar.json',
      json: '{}'
    }
  )

  await api.storage.upload()

  console.log(rVal)

})().catch(e => {
  console.log(e)
})