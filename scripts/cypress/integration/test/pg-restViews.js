let t0 = require("./explicitLogin");
let t01 = require("../common/00_pre_configurations");
let t4a = require("../common/4a_table_view_grid_gallery_form");
let t4b = require("../common/4b_table_view_share");
let t4c = require("../common/4c_form_view_detailed");
let t4d = require("../common/4d_table_view_grid_locked");
let t4e = require("../common/4e_form_view_share");
let t4f = require("../common/4f_pg_grid_view_share");
let t4g = require("../common/4g_table_view_expanded_form");
let t4h = require("../common/4h_kanban");
let t4i = require("../common/4i_survey_form");
const {
  setCurrentMode,
} = require("../../support/page_objects/projectConstants");

const nocoTestSuite = (apiType, dbType) => {
  setCurrentMode(apiType, dbType);
  t01.genTest(apiType, dbType);

  // place plugin related activities at top
  t4c.genTest(apiType, dbType);
  t4a.genTest(apiType, dbType);
  t4b.genTest(apiType, dbType);
  t4d.genTest(apiType, dbType);
  t4e.genTest(apiType, dbType);
  t4f.genTest(apiType, dbType);
  t4g.genTest(apiType, dbType);
  t4h.genTest(apiType, dbType);
  t4i.genTest(apiType, dbType);
};

nocoTestSuite("rest", "postgres");


