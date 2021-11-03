
let t0 = require('./explicitLogin')
let t01 = require('../common/00_pre_configurations')
let t6b = require('../common/6b_downloadCsv')
let t6c = require('../common/6c_swagger_api')
let t6d = require('../common/6d_language_validation')
let t6e = require('../common/6e_project_operations')

// use 0 as mode to execute individual files (debug mode, skip pre-configs)
// use 1 mode if noco.db doesnt contain user credentials (full run over GIT)
const executionMode = 1

const nocoTestSuite = (type, xcdb) => {

    if (0 == executionMode) {
        t0.genTest(type, xcdb)
    } else {
        t01.genTest(type, xcdb)
    }    

    t6b.genTest(type, xcdb)
    t6d.genTest(type, xcdb)
    t6c.genTest(type, xcdb)
    // **deletes created project, hence place it @ end
    t6e.genTest(type, xcdb)    
}

nocoTestSuite('rest', false)

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




