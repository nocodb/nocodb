let t7b = require("../common/7b_import_from_airtable");
let t9a = require("../common/9a_QuickTest");
const {
  setCurrentMode,
} = require("../../support/page_objects/projectConstants");

const nocoTestSuite = (apiType, dbType) => {
  setCurrentMode(apiType, dbType);
  // CY Migration verification / Quick test
  t9a.genTest(apiType, dbType, "CY_QUICK");

  // AT Import verification
  t7b.genTest(apiType, dbType);
  t9a.genTest(apiType, dbType, "AT_IMPORT");
};

nocoTestSuite("rest", "xcdb");


