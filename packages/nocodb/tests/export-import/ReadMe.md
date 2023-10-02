## config.json
{
    "srcProject": "sample",
    "dstProject": "sample-copy",
    "baseURL": "http://localhost:8080",
    "xc-auth": "Copy Auth Token"
}
- baseURL & xc-auth are common configurations for both import & export

## Export
- `srcProject`: specify source base name to be exported.
- Export JSON file will be created as `srcProject.json`
- execute 
 `cd packages/nocodb/tests/export-import`
 `node exportSchema.js`

## Import
- `srcProject`: specify JSON file name to be imported (sans .JSON suffix)
- `dstProject`: new base name to be imported as
- Data will also be imported if `srcProject` exists in NocoDB. Note that, data import isn't via exported JSON
- execute
  `cd packages/nocodb/tests/export-import`
  `node importSchema.js`
