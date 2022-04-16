import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";

let storedURL = "";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - FORM view (Share)`, () => {
        const name = "Test" + Date.now();

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            mainPage.tabReset();
            // open a table to work on views
            //
            cy.openTableTab("City", 25);
        });

        beforeEach(() => {
            cy.restoreLocalStorage();
        });

        afterEach(() => {
            cy.saveLocalStorage();
        });

        after(() => {
            cy.closeTableTab("City");
        });

        // Common routine to create/edit/delete GRID & GALLERY view
        // Input: viewType - 'grid'/'gallery'
        //
        const viewTest = (viewType) => {
            it(`Create ${viewType} view`, () => {
                // click on 'Grid/Gallery' button on Views bar
                cy.get(`.nc-create-${viewType}-view`).click();

                // Pop up window, click Submit (accepting default name for view)
                cy.getActiveModal().find("button:contains(Submit)").click();

                cy.toastWait("View created successfully");

                // Prepare form
                //      add header, description
                //      add post submission message
                //      swap position for City, LastUpdate fields
                //      remove City=>Address field
                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(1)
                    .click();
                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(1)
                    .should("be.checked");

                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .type("A B C D");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .type("Some description about form comes here");
                cy.get(".nc-form > .mx-auto")
                    .find("textarea")
                    .type("Congratulations!");

                // ncv2@fix me
                // cy.get("#data-table-form-LastUpdate").drag(
                //     "#data-table-form-City"
                // );

                cy.get('[title="AddressList"]').drag(".nc-drag-n-drop-to-hide");

                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(1)
                    .should("be.checked");

                // store base URL- to re-visit and delete form view later
                cy.url().then((url) => {
                    storedURL = url;
                });
            });

            it(`Share form view`, () => {
                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(1)
                    .should("be.checked");
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("City1")
                    .click();
                // cy.get(".v-navigation-drawer__content > .container")
                //   .find(".v-list > .v-list-item")
                //   .contains("Share View")
                //   .click();
                mainPage.shareView().click();

                cy.snipActiveModal("Modal_ShareView");

                // copy link text, visit URL
                cy.getActiveModal()
                    .find(".share-link-box")
                    .contains("/nc/form/", { timeout: 10000 })
                    .then(($obj) => {
                        let linkText = $obj.text().trim();
                        cy.log(linkText);
                        cy.visit(linkText, {
                            baseUrl: null,
                        });
                        cy.wait(5000);

                        // wait for share view page to load!
                        cy.get(".nc-form").should("exist");

                        cy.snip("ShareView_Form");

                        // New form appeared? Header & description should exist
                        cy.get(".nc-form", { timeout: 10000 })
                            .find("h2")
                            .contains("A B C D")
                            .should("exist");
                        cy.get(".nc-form", { timeout: 10000 })
                            .find(".body-1")
                            .contains("Some description about form comes here")
                            .should("exist");

                        // all fields, barring removed field should exist
                        cy.get('[title="City"]').should("exist");
                        cy.get('[title="LastUpdate"]').should("exist");
                        cy.get('[title="CountryRead"]').should("exist");
                        cy.get('[title="AddressList"]').should("not.exist");

                        // order of LastUpdate & City field is retained
                        cy.get(".nc-field-wrapper")
                            .eq(1)
                            .contains("LastUpdate")
                            .should("exist");
                        cy.get(".nc-field-wrapper")
                            .eq(0)
                            .contains("City")
                            .should("exist");

                        // submit form, to read message
                        cy.get("#data-table-form-City").type("_abc");
                        cy.get("#data-table-form-LastUpdate").click();
                        cy.getActiveModal()
                            .find("button")
                            .contains("19")
                            .click();
                        cy.getActiveModal()
                            .find("button")
                            .contains("OK")
                            .click();
                        cy.get("button").contains("Link to 'Country'").click();
                        cy.getActiveModal()
                            .find(".child-card")
                            .contains("Afghanistan")
                            .click();

                        // submit button & validate
                        cy.get(".nc-form")
                            .find("button")
                            .contains("Submit")
                            .click();
                        cy.toastWait("Congratulations");
                        cy.get(".v-alert")
                            .contains("Congratulations")
                            .should("exist")
                            .then(() => {
                                cy.get(".nc-form").should("exist");

                                // validate if form has appeared again
                                cy.get(".nc-form", { timeout: 10000 })
                                    .find("h2")
                                    .contains("A B C D")
                                    .should("exist");
                                cy.get(".nc-form", { timeout: 10000 })
                                    .find(".body-1")
                                    .contains(
                                        "Some description about form comes here"
                                    )
                                    .should("exist");
                            });
                    });
            });

            it(`Delete ${viewType} view`, () => {
                // go back to base page
                cy.visit(storedURL, {
                    baseUrl: null,
                });
                cy.wait(5000);

                // number of view entries should be 2 before we delete
                cy.get(".nc-view-item").its("length").should("eq", 2);

                // click on delete icon (becomes visible on hovering mouse)
                cy.get(".nc-view-delete-icon").click({ force: true });
                cy.toastWait("View deleted successfully");

                // confirm if the number of veiw entries is reduced by 1
                cy.get(".nc-view-item").its("length").should("eq", 1);

                // clean up newly added rows into Country table operations
                // this auto verifies successfull addition of rows to table as well
                mainPage.getPagination(25).click();
                cy.get(".nc-grid-row").should("have.length", 1);
                mainPage
                    .getRow(1)
                    .find(".mdi-checkbox-blank-outline")
                    .click({ force: true });

                mainPage.getCell("City", 1).rightclick();
                cy.getActiveMenu().contains("Delete Selected Row").click();
                // cy.toastWait('Deleted selected rows successfully')
            });
        };

        // below scenario's will be invoked twice, once for rest & then for graphql
        viewTest("form");
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
