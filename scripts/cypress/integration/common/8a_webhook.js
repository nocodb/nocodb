import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;
  describe(`Webhook`, () => {
    before(() => {});
    after(() => {});

    it("Create", () => {
      // create an on-insert event webhook
      // nc-btn-webhook
      // nc-btn-create-webhook
    })
    it("Verify trigger", () => {})
    it("Modify trigger event", () => {})
    it("Verify trigger", () => {})
    it("Delete trigger event", () => {})
    it("Verify trigger", () => {})

    it("Create, with condition", () => {})
    it("Verify trigger", () => {})
    it("Modify trigger condition", () => {})
    it("Verify trigger", () => {})
    it("Delete trigger condition", () => {})
    it("Verify trigger", () => {})
  })
}

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