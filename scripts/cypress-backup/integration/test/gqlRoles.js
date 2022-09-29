let t0 = require("./explicitLogin");
let t01 = require("../common/00_pre_configurations");
let t5a = require("../common/5a_user_role");
let t5b = require("../common/5b_preview_role");
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

    t5a.genTest(apiType, dbType);
    t5b.genTest(apiType, dbType);
};

nocoTestSuite("graphql", "mysql");

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
