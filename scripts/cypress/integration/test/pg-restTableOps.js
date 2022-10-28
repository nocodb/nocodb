let t0 = require("./explicitLogin");
let t01 = require("../common/00_pre_configurations");
let t1a = require("../common/1a_table_operations");
let t1b = require("../common/1b_table_column_operations");
let t1c = require("../common/1c_sql_view");
let t1d = require("../common/1d_pg_table_view_drag_drop_reorder");
let t1e = require("../common/1e_pg_meta_sync");
let t2a = require("../common/2a_table_with_belongs_to_colulmn");
let t2b = require("../common/2b_table_with_m2m_column");
let t3a = require("../common/3a_filter_sort_fields_operations");
let t3b = require("../common/3b_formula_column");
let t3c = require("../common/3c_lookup_column");
let t3d = require("../common/3d_rollup_column");
let t3e = require("../common/3e_duration_column");
let t3f = require("../common/3f_link_to_another_record");
const {
  setCurrentMode,
} = require("../../support/page_objects/projectConstants");

const nocoTestSuite = (apiType, dbType) => {
  setCurrentMode(apiType, dbType);
  t01.genTest(apiType, dbType);

  t1a.genTest(apiType, dbType);
  t1b.genTest(apiType, dbType);
  t1c.genTest(apiType, dbType);
  // NcGUI v2 t1d.genTest(apiType, dbType);
  t1e.genTest(apiType, dbType);
  t2a.genTest(apiType, dbType);
  t2b.genTest(apiType, dbType);
  t3a.genTest(apiType, dbType);
  t3b.genTest(apiType, dbType);
  t3c.genTest(apiType, dbType);
  t3d.genTest(apiType, dbType);
  t3e.genTest(apiType, dbType);
  // NcGUI v2 t3e.genTest(apiType, dbType);
  t3f.genTest(apiType, dbType);
};

nocoTestSuite("rest", "postgres");
