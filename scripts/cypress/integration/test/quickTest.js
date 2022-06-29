let t9a = require("../common/9a_QuickTest");
const {
  setCurrentMode,
} = require("../../support/page_objects/projectConstants");

// use 0 as mode to execute individual files (debug mode, skip pre-configs)
// use 1 mode if noco.db doesnt contain user credentials (full run over GIT)

const nocoTestSuite = (apiType, dbType) => {
  setCurrentMode(apiType, dbType);
  t9a.genTest(apiType, dbType);
};

nocoTestSuite("rest", "xcdb");

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
