import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Lock view`, () => {
        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            mainPage.tabReset();

            // open a table to work on views
            //
            cy.openTableTab("Country", 25);
        });

        beforeEach(() => {
        });

        after(() => {
            cy.closeTableTab("Country");
        });

        const lockViewTest = (enabled) => {
            it(`Grid: lock view set to ${enabled}: validation`, () => {
                let vString = enabled ? "not." : "";
                let menuOption = enabled ? 'Locked View' : 'Collaborative View';

                // on menu, collaboration view appears first (at index 0)
                // followed by Locked view (at index 1)
                cy.get(".nc-actions-menu-btn").click();
                cy.getActiveMenu().find('.ant-dropdown-menu-submenu').eq(0).click();
                cy.wait(1000);
                cy.get('.nc-locked-menu-item').contains(menuOption).should('exist').click();

                // cy.get(".nc-sidebar-lock-menu")
                //     .click();
                // cy.getActiveMenu()
                //     .find('.nc-menu-item:visible')
                //     .eq(menuOption)
                //     .click();

                if(enabled) {
                    cy.toastWait('Successfully Switched to locked view')
                    cy.get(".nc-icon-locked").should("exist");
                } else {
                    cy.toastWait('Successfully Switched to collaborative view')
                    cy.get(".nc-icon-collaborative").should("exist");
                }

                // expected toolbar for Lock view: Only lock-view menu, reload, toggle-nav-drawer to be enabled
                //
                // cy.get(".nc-sidebar-lock-menu:enabled")
                //     .should("exist");

                cy.get(".nc-toolbar-reload-btn")
                    .should("exist");
                cy.get(".nc-add-new-row-btn > .cursor-pointer")
                    .should(`${vString}exist`);
                cy.get(".nc-fields-menu-btn:enabled")
                    .should(`${vString}exist`);
                cy.get(".nc-sort-menu-btn:enabled")
                    .should(`${vString}exist`);
                cy.get(".nc-filter-menu-btn:enabled")
                    .should(`${vString}exist`);

                // dblClick on a cell & see if we can edit
                mainPage.getCell("Country", 1).dblclick();
                mainPage
                    .getCell("Country", 1)
                    .find("input")
                    .should(`${vString}exist`);

                cy.get(".nc-row-expand")
                  .should(`${vString}exist`);

                // check if add/ expand options available for 'has many' column type
                // GUI-v2: TBD
                mainPage
                    .getCell("City List", 1)
                    .click()
                    .find(".nc-action-icon.nc-plus")
                    .should(`${vString}exist`);
                mainPage
                    .getCell("City List", 1)
                    .click()
                    .find(".nc-action-icon.nc-arrow-expand")
                    .should(`${vString}exist`);

                // update row option (right click) - should not be available for Lock view
                mainPage.getCell("City List", 1).rightclick();
                cy.get(".ant-dropdown-content").should(
                    `${vString}be.visible`
                );
            });
        };

        // Locked view
        lockViewTest(true);

        // collaboration view
        lockViewTest(false);
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
