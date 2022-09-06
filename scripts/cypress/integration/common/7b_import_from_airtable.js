// Cypress test suite: Project import from Airtable
//

import { isTestSuiteActive, roles } from "../../support/page_objects/projectConstants";
import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";

let apiKey = ""
let sharedBase = ""

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`Import from airtable`, () => {
    before(() => {
      apiKey = Cypress.env("airtable").apiKey;
      sharedBase = Cypress.env("airtable").sharedBase;

      loginPage.signIn(roles.owner.credentials);
      projectsPage.createProject({ dbType: "none", apiType: "REST", name: "importSample" }, {})
    });

    after(() => {
      cy.saveLocalStorage();
    });

    it("Import", () => {
      cy.log(apiKey, sharedBase);

      // trigger import
      cy.get('.nc-add-new-table').should('exist').trigger('mouseover')
      cy.get('.nc-import-menu').should('exist').click()
      cy.getActiveMenu().find('.ant-dropdown-menu-item').contains('Airtable').click()

      cy.getActiveModal().find(".nc-input-api-key").should('exist').clear().type(apiKey)
      cy.getActiveModal().find(".nc-input-shared-base").should('exist').clear().type(sharedBase)
      cy.getActiveModal().find(".nc-btn-airtable-import").should('exist').click()

      // it will take a while for import to finish
      // cy.getActiveModal().find(".nc-btn-go-dashboard", {timeout: 180000}).should('exist').click()

      // wait for import to finish (kludge/hardcoded)
      cy.get(':nth-child(51) > .flex', {timeout: 180000}).contains('Complete!').should('exist')
      cy.get('.ant-modal-close-x').should('exist').click()
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