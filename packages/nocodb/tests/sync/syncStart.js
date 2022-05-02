const jsonfile = require("jsonfile");
const nc_migrate = require('./sync')
// read configurations
//
const syncDB = jsonfile.readFileSync('./testConfig.json');

nc_migrate(syncDB).catch(e => {
  // console.log(e?.config?.url);
  console.log(e)
});
