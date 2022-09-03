import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Table: belongs to, link record`, () => {
        before(() => {

            cy.restoreLocalStorage();
            cy.wait(1000);

            mainPage.tabReset();
            cy.openTableTab("Country", 25);

            cy.saveLocalStorage();
            cy.wait(1000);
        });

        beforeEach(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);
        });

        after(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);

          cy.closeTableTab("City");
        });

        it("URL validation", () => {
            // column name validation
            // cy.get(`.project-tab:contains(Country):visible`).should("exist");
            // URL validation
            cy.url().should("contain", `table/Country`);
        });

        it("Grid cell chip content validation", () => {
          // grid cell content validation
          mainPage.getCell("City List", 1)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("Kabul")
            .should('exist');
          mainPage.getCell("City List", 2)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("Batna")
            .should('exist');
          mainPage.getCell("City List", 2)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("Bchar")
            .should('exist');
          mainPage.getCell("City List", 2)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("Skikda")
            .should('exist');
        })

        it("Expand has-many column", () => {
            mainPage.getCell("City List", 1).should("exist").trigger("mouseover").click();
            cy.get('.nc-action-icon').eq(0).should('exist').click({ force: true });
        });

        it("Expand Link record, validate", () => {
            cy.getActiveModal()
                .find("button:contains(Link to 'City')")
                .click()
                .then(() => {

                    // Link record form validation
                    cy.getActiveModal().contains("Link record").should("exist");
                    cy.getActiveModal()
                        .find(".nc-reload")
                        .should("exist");
                    cy.getActiveModal()
                        .find('button:contains("Add new record")')
                        .should("exist");
                    cy.getActiveModal()
                        .find(".ant-card")
                        .eq(0)
                        .contains("A Corua (La Corua)")
                        .should("exist");

                    cy.getActiveModal()
                        .find("button.ant-modal-close")
                        .click();
                        // .then(() => {
                        //     cy.getActiveModal()
                        //         .find("button.ant-modal-close")
                        //         .click();
                        // });
                });
        });

        it("Belongs to column, validate", () => {
          cy.closeTableTab("Country");
          cy.openTableTab("City", 25);
          cy.url().should("contain", `table/City`);

          // grid cell content validation
          mainPage.getCell("Country", 1)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("Spain")
            .should('exist');
          mainPage.getCell("Country", 2)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("Saudi Arabia")
            .should('exist');
        })
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
