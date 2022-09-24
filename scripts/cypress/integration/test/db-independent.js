let t6d = require("../common/6d_language_validation");

const {
  setCurrentMode,
} = require("../../support/page_objects/projectConstants");
const t01 = require("../common/00_pre_configurations");

const nocoTestSuite = (apiType, dbType) => {
  setCurrentMode(apiType, dbType);

  // Sakila Ext DB project creation
  t01.genTest(apiType, dbType);

  // i18n
  t6d.genTest(apiType, dbType);
};

nocoTestSuite("rest", "mysql");
