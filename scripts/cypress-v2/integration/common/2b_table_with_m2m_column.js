import { mainPage } from "../../support/page_objects/mainPage";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - M2M Column validation`, () => {
        before(() => {
            cy.fileHook();
            mainPage.tabReset();

            // // kludge: wait for page load to finish
            // cy.wait(1000);
            // // close team & auth tab
            // cy.get('button.ant-tabs-tab-remove').should('exist').click();
            // cy.wait(1000);

            cy.openTableTab("Actor", 25);
        });

        beforeEach(() => {
            cy.fileHook();
        });

        after(() => {
            cy.closeTableTab("Actor");
        });

        it("Table column header, URL validation", () => {
            // column name validation
            // cy.get(`.project-tab:contains(Actor):visible`).should("exist");
            // URL validation
            cy.url().should("contain", `table/Actor`);
        });

        it("M2m chip content validation on grid", () => {
          // grid m2m content validation
          mainPage.getCell("Film List", 1)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("ACADEMY DINOSAUR")
            .should('exist');
          mainPage.getCell("Film List", 1)
            .find('.nc-virtual-cell > .chips-wrapper > .chips > .group > .name')
            .contains("ANACONDA CONFESSIONS")
            .should('exist');
        });

        it("Expand m2m column", () => {
            // expand first row
            mainPage.getCell("Film List", 1).should("exist").trigger("mouseover").click();
            cy.get('.nc-action-icon').eq(0).should('exist').click({ force: true });

            // GUI-v2 Kludge:
            // validations
            // cy.getActiveModal().contains("Film").should("exist");
            // cy.getActiveModal().find("button.mdi-reload").should("exist");
            // cy.getActiveModal()
            //     .find("button:contains(Link to 'Film')")
            //     .should("exist");
            cy.getActiveModal()
                .find(".ant-card")
                .eq(0)
                .contains("ACADEMY DINOSAUR")
                .should("exist");
        });

        it('Expand "Link to" record, validate', () => {
            cy.getActiveModal()
                .find("button:contains(Link to 'Film')")
                .click()
                .then(() => {
                    // Link record form validation
                    cy.getActiveModal().contains("Link Record").should("exist");
                    cy.getActiveModal()
                        .find(".nc-reload")
                        .should("exist");
                    cy.getActiveModal()
                        .find('button:contains("Add new record")')
                        .should("exist");
                    cy.getActiveModal()
                        .find(".ant-card")
                        .eq(0)
                        .contains("ACE GOLDFINGER")
                        .should("exist");
                    cy.getActiveModal().find("button.ant-modal-close").click();
                });
        });

        it("Expand first linked card, validate", () => {

            // expand first row
            mainPage.getCell("Film List", 1).should("exist").trigger("mouseover").click();
            cy.get('.nc-action-icon').eq(0).should('exist').click({ force: true });

            cy.getActiveModal()
                .find(".ant-card")
                .eq(0)
                .contains("ACADEMY DINOSAUR", { timeout: 2000 })
                .click()
                .then(() => {
                    // wait to ensure pop up appears before we proceed further
                    cy.wait(1000)
                    // Link card validation
                    cy.getActiveDrawer()
                        .find(".text-lg")
                        .contains("ACADEMY DINOSAUR")
                        .should("exist");
                    cy.getActiveDrawer()
                        .find('button:contains("Save row")')
                        .should("exist");
                    cy.getActiveDrawer()
                        .find('button:contains("Cancel")')
                        .should("exist");

                    cy.getActiveDrawer()
                        .find('button:contains("Cancel")')
                        .click();
                    cy.getActiveModal().find("button.ant-modal-close").click();
                });
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
