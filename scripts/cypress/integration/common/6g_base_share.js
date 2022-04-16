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

            projectsPage.waitHomePageLoad();

            cy.closeTableTab("Actor");
        });

        it(`${roleType}: Validate access permissions: advance menu`, () => {
            _advSettings(roleType, false);
        });

        it(`${roleType}: Validate access permissions: edit schema`, () => {
            _editSchema(roleType, false);
        });

        it(`${roleType}: Validate access permissions: edit data`, () => {
            _editData(roleType, false);
        });

        it(`${roleType}: Validate access permissions: edit comments`, () => {
            _editComment(roleType, false);
        });

        it(`${roleType}: Validate access permissions: view's menu`, () => {
            _viewMenu(roleType, false);
        });
    };

    describe(`${apiType.toUpperCase()} Base VIEW share`, () => {
        before(() => {
            mainPage.tabReset();
        });

        it(`Generate base share URL`, () => {
            // click SHARE
            cy.get(".nc-topright-menu").find(".nc-menu-share").click();

            cy.snipActiveModal("Modal_BaseShare");

            // Click on readonly base text
            cy.getActiveModal().find(".nc-disable-shared-base").click();

            // Select 'Readonly link'
            cy.snipActiveMenu("Menu_ShareLink");
            cy.getActiveMenu()
                .find(".caption")
                .contains("Anyone with the link")
                .click();

            // Copy URL
            cy.getActiveModal()
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
        });

        permissionValidation("viewer");

        it("Update to EDITOR base share link", () => {
            loginPage.loginAndOpenProject(apiType, dbType);

            // click SHARE
            cy.get(".nc-topright-menu").find(".nc-menu-share").click();

            cy.getActiveModal().find(".nc-shared-base-role").click();

            cy.getActiveMenu()
                .find('[role="menuitem"]')
                .contains("Editor")
                .click();
        });

        permissionValidation("editor");

        it("Generate & verify embed HTML IFrame", { baseUrl: null }, () => {
            // open iFrame html
            cy.visit("scripts/cypress/fixtures/sampleFiles/iFrame.html");

            // wait for iFrame to load
            cy.frameLoaded(".nc-embed");

            // for GQL- additionally close GQL Client window
            if (apiType === "graphql") {
                cy.iframe()
                    .find(`[title="Graphql Client"] > button.mdi-close`)
                    .click();
            }

            // validation for base menu opitons
            cy.iframe().find(".nc-project-tree").should("exist");
            cy.iframe().find(".nc-fields-menu-btn").should("exist");
            cy.iframe().find(".nc-sort-menu-btn").should("exist");
            cy.iframe().find(".nc-filter-menu-btn").should("exist");
            cy.iframe().find(".nc-actions-menu-btn").should("exist");

            // validate data (row-1)
            mainPage
                .getIFrameCell("FirstName", 1)
                .contains("PENELOPE")
                .should("exist");
            mainPage
                .getIFrameCell("LastName", 1)
                .contains("GUINESS")
                .should("exist");
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
