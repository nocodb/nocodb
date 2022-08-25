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
            cy.fileHook();
            mainPage.tabReset();
            // open a table to work on views
            //
            cy.openTableTab("City", 25);
        });

        beforeEach(() => {
            cy.fileHook();
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

              // click on create grid view button
              cy.get(`.nc-create-${viewType}-view`).click();

              // Pop up window, click Submit (accepting default name for view)
              cy.getActiveModal().find("button:contains(Submit)").click();

              cy.toastWait("View created successfully");

              // validate if view was creted && contains default name 'Country1'
              cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                .contains("Form-1")
                .should("exist");

                // Prepare form
                //      add header, description
                //      add post submission message
                //      swap position for City, LastUpdate fields
                //      remove City=>Address field
                // enable "Submit another form" check box
                cy.get("button.nc-form-checkbox-show-blank-form").click();

                // Update header & add some description, verify
                cy.get(".nc-form")
                  .find('[placeholder="Form Title"]')
                  .clear()
                  .type("A B C D");
                cy.get(".nc-form")
                  .find('[placeholder="Add form description"]')
                  .type("Some description about form comes here");

                // add message
                cy.get("textarea.nc-form-after-submit-msg")
                  .type("Congratulations!");

                // move Country field down (drag, drop)
                cy.get(".nc-form-drag-LastUpdate").drag(
                  ".nc-form-drag-City");

                cy.get('[title="Address List"]').drag(".nc-drag-n-drop-to-hide");

                // cy.get(".nc-form > .mx-auto")
                //     .find('[type="checkbox"]')
                //     .eq(1)
                //     .should("be.checked");

                // store base URL- to re-visit and delete form view later
                cy.url().then((url) => {
                    storedURL = url;
                });
            });

            it(`Share form view`, () => {
                // cy.get(".nc-form > .mx-auto")
                //     .find('[type="checkbox"]')
                //     .eq(1)
                //     .should("be.checked");
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .click();

                mainPage.shareView().click({ force: true });

                cy.wait(5000);

                // copy link text, visit URL
                cy.getActiveModal()
                    .find(".share-link-box")
                    .contains("/nc/form/", { timeout: 10000 })
                    .should("exist")
                    .then(($obj) => {
                        let linkText = $obj.text().trim();
                        cy.log(linkText);
                        cy.visit(linkText, {
                            baseUrl: null,
                        });
                        cy.wait(5000);

                        // wait for share view page to load!

                        cy.get(".nc-form").should("exist");

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
                        cy.get('[title="Country"]').should("exist");
                        cy.get('[title="Address List"]').should("not.exist");

                        // order of LastUpdate & City field is retained
                        cy.get(".nc-form-field")
                            .eq(1)
                            .contains("LastUpdate")
                            .should("exist");
                        cy.get(".nc-form-field")
                            .eq(0)
                            .contains("City")
                            .should("exist");

                        // submit form, to read message
                        cy.get(".nc-form-input-City").type("_abc");
                        cy.get(".nc-form-input-LastUpdate").click();
                        cy.getActiveModal().find("button").contains("19").click();
                        cy.getActiveModal().find("button").contains("OK").click();

                        cy.get('.nc-form-field-Country')
                          .trigger('mouseover')
                          .click()
                          .find('.nc-action-icon')
                          .click();
                        // cy.get("button").contains("Link to 'Country'").click();
                        cy.getActiveModal()
                            .find(".ant-card")
                            .contains("Afghanistan")
                            .click();

                        // submit button & validate
                        cy.get(".nc-form")
                            .find("button")
                            .contains("Submit")
                            .click();

                        cy.get(".ant-alert-message")
                            .contains("Congratulations")
                            .should("exist")
                            .then(() => {
                                cy.get(".nc-form").should("exist");

                                // validate if form has appeared again
                                cy.get(".nc-share-form-title")
                                  .contains("A B C D")
                                  .should("exist");
                                cy.get(".nc-share-form-desc")
                                  .contains("Some description about form comes here")
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
                // kludge: flicker on load
                cy.wait(3000)

                cy.get(".nc-grid-row").should("have.length", 1);
                cy.get(".ant-checkbox").should('exist').eq(1).click({ force: true });
                mainPage.getCell("Country", 1).rightclick({ force: true });
                cy.getActiveMenu()
                  .contains("Delete Selected Rows")
                  .click({ force: true });
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
