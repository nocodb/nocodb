// Cypress test suite: Project import from Airtable
//

import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";

let apiKey = ""
let sharedBase = ""

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`Import from airtable`, () => {
    before(() => {
      cy.fileHook();
      apiKey = Cypress.env("airtable").apiKey;
      sharedBase = Cypress.env("airtable").sharedBase;

      mainPage.toolBarTopLeft(mainPage.HOME).click({force: true})
      projectsPage.createProject({ dbType: "none", apiType: "REST", name: "importSample" }, {})
      // projectsPage.openProject("importSample")
      // cy.openTableTab("Film", 3)
    });

    after(() => {});

    it("Import", () => {
      cy.log(apiKey, sharedBase);

      // trigger import
      cy.get(".add-btn").click();
      cy.getActiveMenu().contains("Airtable").should('exist').click();

      // enable turbo
      // cy.getActiveModal().find(".nc-btn-enable-turbo").should('exist').click()

      cy.getActiveModal().find(".nc-input-api-key").should('exist').clear().type(apiKey)
      cy.getActiveModal().find(".nc-input-shared-base").should('exist').clear().type(sharedBase)
      cy.getActiveModal().find(".nc-btn-airtable-import").should('exist').click()

      // it will take a while for import to finish
      cy.getActiveModal().find(".nc-btn-go-dashboard", {timeout: 180000}).should('exist').click()

    });
  });
};


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