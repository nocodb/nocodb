import { mainPage, settingsPage } from "../../support/page_objects/mainPage";
import {loginPage, projectsPage} from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  describe(`${apiType.toUpperCase()} ERD`, () => {
    before(() => {
      loginPage.loginAndOpenProject(apiType, dbType);
      cy.openTableTab("Country", 25);
      cy.saveLocalStorage();
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    })

    afterEach(() => {
      cy.saveLocalStorage();
    })

    after(() => {
      cy.restoreLocalStorage();
      cy.closeTableTab("Country");
      cy.saveLocalStorage();
    });

    // Test cases

    it(`Open Table ERD`, () => {
      mainPage.openErdTab();
    });

    it(`Verify ERD Context menu`, () => {
      cy.get('.nc-erd-context-menu').should('be.visible');
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').should('have.length', 3);
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(0).should('have.class', 'ant-checkbox-checked');
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(1).should('have.class', 'ant-checkbox-checked');
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(2).should('not.have.class', 'ant-checkbox-checked');

      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(0).click();
    });

    it(`test-1`, () => {
      cy.log("test-1");
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
