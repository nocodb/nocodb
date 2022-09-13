import { mainPage } from "../../support/page_objects/mainPage";
import { projectsPage } from "../../support/page_objects/navigation";
import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import {
    _advSettings,
    _editSchema,
    _editData,
    _editComment,
    _viewMenu,
    _topRightMenu,
} from "../spec/roleValidation.spec";
import {linkSync} from "fs";

// fix me
let linkText = "";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    const permissionValidation = (roleType) => {
        it(`${roleType}: Visit base shared URL`, () => {
            cy.log(linkText);

            // visit URL & wait for page load to complete
            cy.visit(linkText, {
                baseUrl: null,
            });
            cy.wait(5000);
         });

        it(`${roleType}: Validate access permissions: advance menu`, () => {
            // cy.restoreLocalStorage();
            _advSettings(roleType, "baseShare");
        });

        it(`${roleType}: Validate access permissions: edit schema`, () => {
            // cy.restoreLocalStorage();
            _editSchema(roleType, "baseShare");
        });

        it(`${roleType}: Validate access permissions: edit data`, () => {
            // cy.restoreLocalStorage();
            _editData(roleType, "baseShare");
        });

        it(`${roleType}: Validate access permissions: edit comments`, () => {
            // cy.restoreLocalStorage();
            _editComment(roleType, "baseShare");
        });

        it(`${roleType}: Validate access permissions: view's menu`, () => {
            // cy.restoreLocalStorage();
            _viewMenu(roleType, "baseShare");
        });
    };

    describe(`${apiType.toUpperCase()} Base VIEW share`, () => {
        before(() => {
            loginPage.loginAndOpenProject(apiType, dbType);

            cy.openTableTab("Country", 25);
            cy.wait(1000);

            cy.saveLocalStorage();
            cy.wait(1000);
        });

        it(`Generate base share URL`, () => {

            cy.restoreLocalStorage();
            cy.wait(1000);

            // click SHARE
            cy.get(".nc-share-base:visible").should('exist').click();

            // Click on readonly base text
            cy.getActiveModal().find(".nc-disable-shared-base").click();

            cy.getActiveMenu(".nc-dropdown-shared-base-toggle")
                .find(".ant-dropdown-menu-title-content")
                .contains("Anyone with the link")
                .click();

            cy.getActiveModal().find(".nc-shared-base-role").click();

            cy.getActiveSelection()
              .find('.ant-select-item')
              .eq(1)
              .click();

            // Copy URL
            cy.getActiveModal(".nc-modal-invite-user-and-share-base")
                .find(".nc-url")
                .then(($obj) => {
                    cy.log($obj[0]);
                    linkText = $obj[0].innerText.trim();

                    const htmlFile = `
<!DOCTYPE html>
<html>
<body>

<iframe
class="nc-embed"
src="${linkText}?embed"
frameborder="0"
width="100%"
height="700"
style="background: transparent; "></iframe>

</body>
</html>
            `;
                    cy.writeFile(
                        "scripts/cypress/fixtures/sampleFiles/iFrame.html",
                        htmlFile
                    );
                });

            cy.log(linkText);

            cy.signOut();
            cy.deleteLocalStorage();
            cy.wait(1000);
            cy.printLocalStorage();

        });

        permissionValidation("viewer");

        it("Update to EDITOR base share link", () => {
            loginPage.loginAndOpenProject(apiType, dbType);

            // click SHARE
            cy.get(".nc-share-base:visible").should('exist').click();

            cy.getActiveModal().find(".nc-shared-base-role").click();

            cy.getActiveSelection()
                .find('.ant-select-item')
                .eq(0)
                .click();

            cy.signOut();
            cy.deleteLocalStorage();
            cy.wait(1000);
            cy.printLocalStorage();

        });

        permissionValidation("editor");
    });

    describe(`${apiType.toUpperCase()} iFrame Test`, () => {
        // https://docs.cypress.io/api/commands/visit#Prefixes
        it("Generate & verify embed HTML IFrame", {baseUrl: null}, () => {

            let filePath = "scripts/cypress/fixtures/sampleFiles/iFrame.html";
            cy.log(filePath);
            cy.visit(filePath, {baseUrl: null});

            // wait for iFrame to load
            cy.frameLoaded(".nc-embed");

            // cy.openTableTab("Country", 25);
            cy.iframe().find(`.nc-project-tree-tbl-Actor`, {timeout: 10000}).should("exist")
                .first()
                .click({force: true});

            // validation for base menu opitons
            cy.iframe().find(".nc-project-tree").should("exist");
            cy.iframe().find(".nc-fields-menu-btn").should("exist");
            cy.iframe().find(".nc-sort-menu-btn").should("exist");
            cy.iframe().find(".nc-filter-menu-btn").should("exist");
            cy.iframe().find(".nc-actions-menu-btn").should("exist");

            // validate data (row-1)
            cy.iframe().find(`.nc-grid-cell`).eq(1).contains("PENELOPE").should("exist");
            cy.iframe().find(`.nc-grid-cell`).eq(2).contains("GUINESS").should("exist");

        });
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
