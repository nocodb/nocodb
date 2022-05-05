let Api = require('nocodb-sdk').Api;
let hash = require('object-hash');
const jsonfile = require("jsonfile");
const Airtable = require("airtable");
const { UITypes } = require("nocodb-sdk");
const { default: axios } = require("axios");
const FormData = require("form-data");

let api = {}, base = {}
let stats = {
  airtable: {
    apiCnt: 0
  }
}
// read configurations
//
const config = jsonfile.readFileSync('./testConfig.json');

async function nc_syncPeriodic(syncDB) {
  api = new Api({
    baseURL: syncDB.baseURL,
    headers: {
      'xc-auth': syncDB.authToken
    }
  });

  base = new Airtable({ apiKey: syncDB.airtable.apiKey }).base(
    syncDB.airtable.baseId
  );

  // get project schema using project name
  let projName = syncDB.projectName;
  let projList = await api.project.list()
  let projId = projList.list.find(a => a.title === projName)?.id
  if(!projId) return;
  let projSchema = await api.dbTable.list(projId)

  // for every table, trigger sync
  for(let tblCnt = 0; tblCnt < projSchema.list.length; tblCnt++)
  {
    // retrieve essentials
    let tblName = projSchema.list[tblCnt].title;
    let tblId = projSchema.list[tblCnt].id;
    let tblSchema = await api.dbTable.read(tblId)

    // build hash store for this table
    let tblRecIdHashStore = []
    while(1) {
      let tblRecIdHashArray = await api.dbTableRow.list('nc', projName, tblName,{
          fields: ["_aTbl_nc_rec_id", "_aTbl_nc_rec_hash"],
          limit: 100,
          offset: tblRecIdHashStore.length
        });
      tblRecIdHashStore = [...tblRecIdHashStore, ...tblRecIdHashArray.list]
      if(tblRecIdHashArray.pageInfo.isLastPage) break;
    }

    // read airtable records for this table & sync
    await nocoReadData(syncDB, tblSchema, tblRecIdHashStore)
  }
  console.log('Airtable API invoked: ', stats.airtable.apiCnt)
}

async function nocoReadData(sDB, table, hashStore) {
  return new Promise((resolve, reject) => {
    base(table.title)
      .select({ pageSize: 100 })
      .eachPage(
        function page(records, fetchNextPage) {
          stats.airtable.apiCnt++;

          for(let recCnt = 0; recCnt < records.length; recCnt++) {
            let newHash = hash(records[recCnt])
            let ncRec = hashStore.find(x => x._aTbl_nc_rec_id === records[recCnt].id)
            let ncRecIdx = hashStore.findIndex(x => x._aTbl_nc_rec_id === records[recCnt].id)

            if(undefined === ncRec) {
              // new record in airtable, insert
              console.log('record inserted')
              nocoBaseDataProcessing(sDB, table, records[recCnt], { newRecord: true })
            }
            else if(newHash === ncRec._aTbl_nc_rec_hash) {
              // same hash, nothing changed from airtable
              hashStore.splice(ncRecIdx, 1)
            }
            else {
              // record modified
              console.log('record modified');
              nocoBaseDataProcessing(sDB, table, records[recCnt], { newRecord: false })
              hashStore.splice(ncRecIdx, 1)
            }
          }
          fetchNextPage();
        },
        function done(err) {
          stats.airtable.apiCnt++;
          if (err) {
            console.error(err);
            reject(err)
          }
          for(let delRecCnt = 0; delRecCnt<hashStore.length; delRecCnt++) {
            console.log('record deleted');
            (async() => {
              await api.dbTableRow.delete('nc', sDB.projectName, table.title, hashStore[delRecCnt]._aTbl_nc_rec_id)
            })().catch(e => console.log(e))
          }
          resolve()
        }
      );
  })
}

// fix me: duplicated routine from sync.js
//
function nocoBaseDataProcessing(sDB, table, record, options) {
  (async () => {
    let recordHash = hash(record);
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

      // if currency, set decimal place to 2
      //
      if (dt === UITypes.Currency) rec[key] = value.toFixed(2);

      // we will pick up LTAR once all table data's are in place
      if (dt === UITypes.LinkToAnotherRecord) {
        aTblDataLinks.push(JSON.parse(JSON.stringify(rec)));
        delete rec[key];
      }

      // these will be automatically populated depending on schema configuration
      if (dt === UITypes.Lookup) delete rec[key];
      if (dt === UITypes.Rollup) delete rec[key];

      if (dt === UITypes.Collaborator) {
        // in case of multi-collaborator, this will be an array
        if(Array.isArray(value)) {
          let collaborators = ""
          for(let i=0; i<value.length; i++) {
            collaborators += `${value[i]?.name} <${value[i]?.email}>, `
            rec[key] = collaborators
          }
        } else rec[key] = `${value?.name} <${value?.email}>`;
      }

      if (dt === UITypes.Barcode) rec[key] = value.text;
      if (dt === UITypes.Button) rec[key] = `${value?.label} <${value?.url}>`;

      if (dt === UITypes.Attachment) {
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
            .post(sDB.baseURL + '/api/v1/db/storage/upload', imageFile, {
              params: {
                path: `noco/${sDB.projectName}/${table.title}/${key}`
              },
              headers: {
                'Content-Type': `multipart/form-data; boundary=${imageFile._boundary}`,
                'xc-auth': sDB.authToken
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
    rec['_aTbl_nc_rec_hash'] = recordHash;

    if(options.newRecord) {
      await api.dbTableRow.bulkCreate('nc', sDB.projectName, table.id, [rec]);
    }
    else {
      await api.dbTableRow.update('nc', sDB.projectName, table.id, record.id, rec)
    }

  })().catch(e => {
    console.log(e)
    console.log(`Record insert error`)
  });
}

nc_syncPeriodic(config).catch(e => {
  console.log(e)
});
