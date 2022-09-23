import { loginPage } from "../../support/page_objects/navigation";
import { isXcdb, roles } from "../../support/page_objects/projectConstants";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  describe(`${apiType.toUpperCase()} Project operations`, () => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    before(() => {
      cy.restoreLocalStorage();
      cy.visit("/");
      cy.wait(4000);
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    it("Delete Project", () => {
      cy.get(`.nc-action-btn`).should("exist").last().click();

      cy.getActiveModal(".nc-modal-project-delete")
        .find(".ant-btn-dangerous")
        .should("exist")
        .click();
    });
  });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
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
