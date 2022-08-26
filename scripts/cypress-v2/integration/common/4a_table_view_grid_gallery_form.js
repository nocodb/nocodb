import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

// let viewTypeString = ["", "Form", "Gallery", "Grid"];

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Table views: Create/Edit/Delete`, () => {
        const name = "Test" + Date.now();

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            cy.fileHook();
            mainPage.tabReset();

            // // kludge: wait for page load to finish
            // cy.wait(1000);
            // // close team & auth tab
            // cy.get('button.ant-tabs-tab-remove').should('exist').click();
            // cy.wait(1000);

            // open a table to work on views
            //
            cy.openTableTab("Country", 25);

            cy.get('.nc-toggle-right-navbar').should('exist').click();
        });

        beforeEach(() => {
            cy.fileHook();
        });

        after(() => {
            cy.closeTableTab("Country");
        });

        // Common routine to create/edit/delete GRID & GALLERY view
        // Input: viewType - 'grid'/'gallery'
        //
        const viewTest = (viewType) => {
            it(`Create ${viewType} view`, () => {
                // click on 'Grid/Gallery' button on Views bar
                cy.get(`.nc-create-${viewType}-view`).click();

                // Pop up window, click Submit (accepting default name for view)
                // cy.getActiveModal().find("button:contains(Submit)").click();
                cy.getActiveModal().find(".ant-btn-primary").click();
                cy.toastWait("View created successfully");

                // kludge: right navbar closes abruptly. force it open again
                window.localStorage.setItem('nc-right-sidebar', '{"isOpen":true,"hasSidebar":true}')

                // validate if view was created && contains default name 'Country1'
                cy.get(`.nc-${viewType}-view-item`)
                    .contains(`${capitalizeFirstLetter(viewType)}-1`)
                    .should("exist");
            });

            it(`Edit ${viewType} view name`, () => {
                // click on edit-icon (becomes visible on hovering mouse)
                // cy.get(".nc-view-edit-icon").last().click({
                //     force: true,
                //     timeout: 1000,
                // });
                cy.get(`.nc-${viewType}-view-item`).last().dblclick();

                // feed new name
                cy.get(`.nc-${viewType}-view-item input`)
                    .clear()
                    .type(`${viewType}View-1{enter}`);
                cy.toastWait("View renamed successfully");

                // kludge: right navbar closes abruptly. force it open again
                window.localStorage.setItem('nc-right-sidebar', '{"isOpen":true,"hasSidebar":true}')

                // validate
                cy.get(`.nc-${viewType}-view-item`)
                    .contains(`${viewType}View-1`)
                    .should("exist");
            });

            it(`Delete ${viewType} view`, () => {
                // number of view entries should be 2 before we delete
                cy.get(".nc-view-item").its("length").should("eq", 2);

                cy.get(`.nc-${viewType}-view-item`).last().click();
                cy.wait(3000);

                // click on delete icon (becomes visible on hovering mouse)
                cy.get(`.nc-${viewType}-view-item`).last().trigger("mouseover").then(() => {
                    cy.get(".nc-view-delete-icon").should('exist').click({force: true});
                    cy.getActiveModal().find(".ant-btn-dangerous").click();
                    cy.toastWait("View deleted successfully");
                })

                // kludge: right navbar closes abruptly. force it open again
                window.localStorage.setItem('nc-right-sidebar', '{"isOpen":true,"hasSidebar":true}')

                // confirm if the number of veiw entries is reduced by 1
                cy.get(".nc-view-item").its("length").should("eq", 1);
            });
        };

        // below four scenario's will be invoked twice, once for rest & then for graphql
        viewTest("grid");  // grid view
        viewTest("gallery");  // gallery view
        viewTest("form");  // form view
    });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Raju Udava <sivadstala@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
