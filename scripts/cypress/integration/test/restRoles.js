let t0 = require("./explicitLogin");
let t01 = require("../common/00_pre_configurations");
let t5a = require("../common/5a_user_role");
let t5b = require("../common/5b_preview_role");
let t5c = require("../common/5c_super_user_role");
const {
  setCurrentMode,
} = require("../../support/page_objects/projectConstants");

const nocoTestSuite = (apiType, dbType) => {
  setCurrentMode(apiType, dbType);
  t01.genTest(apiType, dbType);

  // t5a.genTest(apiType, dbType);
  // t5b.genTest(apiType, dbType);
  t5c.genTest(apiType, dbType);
};

nocoTestSuite("rest", "mysql");


