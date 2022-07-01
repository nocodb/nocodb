import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - Table: belongs to, link record`, () => {
        before(() => {
            mainPage.tabReset();
            cy.openTableTab("Country", 25);
        });

        after(() => {
          cy.closeTableTab("City");
        });

        it("Table column header, URL validation", () => {
            // column name validation
            cy.get(`.project-tab:contains(Country):visible`).should("exist");
            // URL validation
            cy.url().should("contain", `name=Country`);
        });

        it("Grid cell chip content validation", () => {
          // grid cell content validation
          mainPage.getCell("City List", 1)
            .find('.nc-virtual-cell > .v-lazy > .d-flex > .chips')
            .contains("Kabul")
            .should('exist');
          mainPage.getCell("City List", 2)
            .find('.nc-virtual-cell > .v-lazy > .d-flex > .chips')
            .contains("Batna")
            .should('exist');
          mainPage.getCell("City List", 2)
            .find('.nc-virtual-cell > .v-lazy > .d-flex > .chips')
            .contains("Bchar")
            .should('exist');
          mainPage.getCell("City List", 2)
            .find('.nc-virtual-cell > .v-lazy > .d-flex > .chips')
            .contains("Skikda")
            .should('exist');
        })

        it("Expand has-many column", () => {
            // expand first row
            cy.get('td[data-col="City List"] div:visible', {
                timeout: 12000,
            })
                .first()
                .click();
            cy.get('td[data-col="City List"] div .mdi-arrow-expand:visible')
                .first()
                .click();

            cy.snipActiveModal("Modal_BelongsTo");
        });

        it("Expand Link record, validate", () => {
            cy.getActiveModal()
                .find("button:contains(Link to 'City')")
                .click()
                .then(() => {
                    cy.snipActiveModal("Modal_BT_LinkRecord");

                    // Link record form validation
                    cy.getActiveModal().contains("Link Record").should("exist");
                    cy.getActiveModal()
                        .find("button.mdi-reload")
                        .should("exist");
                    cy.getActiveModal()
                        .find('button:contains("New Record")')
                        .should("exist");
                    cy.getActiveModal()
                        .find(".child-card")
                        .eq(0)
                        .contains("A Corua (La Corua)")
                        .should("exist");

                    cy.getActiveModal()
                        .find("button.mdi-close")
                        .click()
                        .then(() => {
                            cy.getActiveModal()
                                .find("button.mdi-close")
                                .click();
                        });
                });
        });

        it("Belongs to column, validate", () => {
          cy.closeTableTab("Country");
          cy.openTableTab("City", 25);
          cy.get(`.project-tab:contains(City):visible`).should("exist");
          cy.url().should("contain", `name=City`);

          // grid cell content validation
          mainPage.getCell("Country", 1)
            .find('.nc-virtual-cell > .v-lazy > .d-flex > .chips')
            .contains("Spain")
            .should('exist');
          mainPage.getCell("Country", 2)
            .find('.nc-virtual-cell > .v-lazy > .d-flex > .chips')
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
