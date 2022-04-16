let t0 = require("./explicitLogin");
let t01 = require("../common/00_pre_configurations");
let t6b = require("../common/6b_downloadCsv");
let t6c = require("../common/6c_swagger_api");
let t6d = require("../common/6d_language_validation");
let t6e = require("../common/6e_project_operations");
let t6f = require("../common/6f_attachments");
let t6g = require("../common/6g_base_share");
let t7a = require("../common/7a_create_project_from_excel");
const {
    setCurrentMode,
} = require("../../support/page_objects/projectConstants");

// use 0 as mode to execute individual files (debug mode, skip pre-configs)
// use 1 mode if noco.db doesnt contain user credentials (full run over GIT)
const executionMode = 1;

const nocoTestSuite = (apiType, dbType) => {
    setCurrentMode(apiType, dbType);
    if (0 == executionMode) {
        t0.genTest(apiType, dbType);
    } else {
        t01.genTest(apiType, dbType);
    }

    t6b.genTest(apiType, dbType);
    t6d.genTest(apiType, dbType);
    // exclude@ncv2 t6c.genTest(apiType, dbType);
    t6f.genTest(apiType, dbType);
    t6g.genTest(apiType, dbType);
    // **deletes created project, hence place it @ end
    t6e.genTest(apiType, dbType);

    // intended to keep this after earlier project deletion
    // creates project using excel & deletes it
    // exclude@ncv2 t7a.genTest(apiType, dbType);
};

nocoTestSuite("rest", "mysql");

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
