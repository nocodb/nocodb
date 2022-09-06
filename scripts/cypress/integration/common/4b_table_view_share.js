import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import {loginPage} from "../../support/page_objects/navigation";

let storedURL = "";
let linkText = "";

const generateLinkWithPwd = () => {
    mainPage.shareView().click();
    cy.getActiveModal().find(".ant-modal-title").contains("This view is shared via a private link").should("be.visible");

    // enable checkbox & feed pwd, save
    cy.getActiveModal().find('.ant-collapse').should('exist').click()
      cy.getActiveModal().find('.ant-checkbox-input').should('exist').first().then(($el) => {
        if (!$el.prop("checked")) {
            cy.wrap($el).click({ force: true });
            cy.getActiveModal().find('input[type="password"]').clear().type("1");
            cy.getActiveModal().find('button:contains("Save password")').click();
            cy.toastWait("Successfully updated");
        }
    });
    
    // copy link text, visit URL
    cy.getActiveModal()
        .find(".nc-share-link-box")
        .then(($obj) => {
            linkText = $obj.text().trim();
            cy.log(linkText);
        });
};

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Shared VIEWs (GRID)`, () => {
        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);

            mainPage.tabReset();
            cy.openTableTab("City", 25);

            // store base URL- to re-visit and delete form view later
            cy.url().then((url) => {
                storedURL = url;
            });
            generateLinkWithPwd();

            cy.signOut();
        });

        beforeEach(() => {
        });

        afterEach(() => {
        });

        it("Share view with incorrect password", () => {
            cy.visit(linkText, {
                baseUrl: null,
            });

            cy.getActiveModal().should("exist");

            // feed password
            cy.getActiveModal().find('input[type="password"]').clear().type("a");
            cy.getActiveModal().find('button:contains("Unlock")').click();

            // if pwd is incorrect, active modal requesting to feed in password again will persist
            cy.getActiveModal().find('button:contains("Unlock")').should('exist');
        });

        // fallover test- use previously opened view & continue verification instead of opening again
        it("Share view with correct password", () => {

            // feed password
            cy.getActiveModal()
                .find('input[type="password"]')
                .clear()
                .type("1");
            cy.getActiveModal().find('button:contains("Unlock")').click();

            // if pwd is incorrect, active modal requesting to feed in password again will persist
            // cy.getActiveModal().find('button:contains("Unlock")').should('not.exist');
            // cy.get(".ant-modal-content:visible").should("not.exist")

            cy.wait(1000);

            // Verify Download as CSV is here
            mainPage.downloadCsv().should("exist");
            cy.get(".nc-actions-menu-btn").should('exist').click();

            mainPage.downloadExcel().should("exist");
            cy.get(".nc-actions-menu-btn").should('exist').click();
        });

        it("Delete view",  () => {
            loginPage.loginAndOpenProject(apiType, dbType);
            cy.openTableTab("City", 25);
            cy.wait(500);
            mainPage.toggleRightSidebar();
            cy.wait(500);

            cy.saveLocalStorage();
            cy.wait(1000);

            // wait for page load to complete
            cy.get(".nc-grid-row").should("have.length", 25);
            mainPage.deleteCreatedViews();
        });

        after(() => {
            cy.restoreLocalStorage();
            cy.wait(500);

            cy.closeTableTab("City");
        });
    });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
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
