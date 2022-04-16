import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";

let formViewURL;

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - FORM view`, () => {
        const name = "Test" + Date.now();

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            mainPage.tabReset();
            // open a table to work on views
            //
            cy.openTableTab("Country", 25);
        });

        beforeEach(() => {
            cy.restoreLocalStorage();
        });

        afterEach(() => {
            cy.saveLocalStorage();
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
                cy.getActiveModal().find("button:contains(Submit)").click();

                cy.toastWait("View created successfully");

                // validate if view was creted && contains default name 'Country1'
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .should("exist");
            });

            it(`Validate ${viewType} view: Drag & drop for re-order items`, () => {
                // default order: Country, LastUpdate, Country => City
                cy.get(".nc-field-wrapper")
                    .eq(0)
                    .contains("Country")
                    .should("exist");
                cy.get(".nc-field-wrapper")
                    .eq(1)
                    .contains("LastUpdate")
                    .should("exist");

                // move Country field down (drag, drop)
                cy.get("#data-table-form-LastUpdate").drag(
                    "#data-table-form-Country"
                );

                // Verify if order is: LastUpdate, Country, Country => City
                cy.get(".nc-field-wrapper")
                    .eq(0)
                    .contains("LastUpdate")
                    .should("exist");
                cy.get(".nc-field-wrapper")
                    .eq(1)
                    .contains("Country")
                    .should("exist");
            });

            it(`Validate ${viewType} view: Drag & drop for add/remove items`, () => {
                // default, only one item in menu-bar; ensure LastUpdate field was present in form view
                cy.get(".col-md-4").find(".pointer.item").should("not.exist");
                cy.get(".nc-field-wrapper")
                    .eq(0)
                    .contains("LastUpdate")
                    .should("exist");

                // drag 'LastUpdate' & drop into menu bar drag-drop box
                cy.get("#data-table-form-LastUpdate").drag(
                    ".nc-drag-n-drop-to-hide"
                );

                // validate- fields count in menu bar to be increased by 1 &&
                // first member in 'formView' is Country
                cy.get(".nc-field-wrapper")
                    .eq(0)
                    .contains("Country")
                    .should("exist");
                cy.get(".col-md-4")
                    .find(".pointer.item")
                    .its("length")
                    .should("eq", 1);
            });

            it(`Validate ${viewType} view: Inverted order field member addition from menu`, () => {
                cy.get(".col-md-4")
                    .find(".pointer.caption")
                    .contains("Remove all")
                    .click();

                // click fields in inverted order: LastUpdate, Country => City
                cy.get(".col-md-4").find(".pointer.item").eq(1).click();
                cy.get(".col-md-4").find(".pointer.item").eq(0).click();

                // verify if order of appearance in form is right
                // Country was never removed as its required field. Other two will appear in inverted order
                cy.get(".nc-field-wrapper")
                    .eq(0)
                    .contains("Country")
                    .should("exist");
                cy.get(".nc-field-wrapper")
                    .eq(1)
                    .contains("CityList")
                    .should("exist");
                cy.get(".nc-field-wrapper")
                    .eq(2)
                    .contains("LastUpdate")
                    .should("exist");
            });

            it(`Validate ${viewType}: Form header & description validation`, () => {
                // Header & description should exist
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .should("exist");

                // Update header & add some description, verify
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .type("A B C D");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .type("Some description about form comes here");

                // validate new contents
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");
            });

            it(`Validate ${viewType}: Add all, Remove all validation`, () => {
                // .col-md-4 : left hand menu
                // .nc-form : form view (right hand side)

                // ensure buttons exist on left hand menu
                cy.get(".col-md-4")
                    .find(".pointer.caption")
                    .contains("Add all")
                    .should("not.exist");
                cy.get(".col-md-4")
                    .find(".pointer.caption")
                    .contains("Remove all")
                    .should("exist");

                // click: remove-all
                cy.get(".col-md-4")
                    .find(".pointer.caption")
                    .contains("Remove all")
                    .click();
                // form should not contain any "field remove icons" -- except for mandatory field (Country)
                cy.get(".nc-form")
                    .find(".nc-field-remove-icon")
                    .its("length")
                    .should("eq", 1);
                // menu bar should contain 3 .pointer.item (LastUpdate, County->City)
                cy.get(".col-md-4")
                    .find(".pointer.item")
                    .its("length")
                    .should("eq", 2);

                // click: Add all
                // cy.get('.col-md-4').find('.pointer.caption').contains('Remove all').should('not.exist')
                cy.get(".col-md-4")
                    .find(".pointer.caption")
                    .contains("Add all")
                    .click();
                cy.get(".col-md-4")
                    .find(".pointer.caption")
                    .contains("Remove all")
                    .should("exist");
                // form should contain "field remove icons"
                cy.get(".nc-form")
                    .find(".nc-field-remove-icon")
                    .should("exist");
                // Fix me: a dummy remove icon is left over on screen
                cy.get(".nc-form")
                    .find(".nc-field-remove-icon")
                    .its("length")
                    .should("eq", 3);
                // menu bar should not contain .pointer.item (column name/ field name add options)
                cy.get(".col-md-4").find(".pointer.item").should("not.exist");
            });

            it(`Validate ${viewType}: Submit default, empty show this message textbox`, () => {
                // fill up mandatory fields
                cy.get("#data-table-form-Country").type("_abc");
                cy.get("#data-table-form-LastUpdate").click();
                cy.getActiveModal().find("button").contains("19").click();
                cy.getActiveModal().find("button").contains("OK").click();

                // default message, no update

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.toastWait("Saved successfully");
                cy.get(".v-alert")
                    .contains("Successfully submitted form data")
                    .should("exist");

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Submit default, with valid Show message entry`, () => {
                // clicking again on view name shows blank still. work around- toggling between two views
                // cy.get(`.nc-view-item.nc-grid-view-item`)
                //     .contains("Country")
                //     .click();
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .click();

                // fill up mandatory fields
                cy.get("#data-table-form-Country").type("_abc");
                cy.get("#data-table-form-LastUpdate").click();
                cy.getActiveModal().find("button").contains("19").click();
                cy.getActiveModal().find("button").contains("OK").click();

                // add message
                cy.get(".nc-form > .mx-auto")
                    .find("textarea")
                    .type("Congratulations!");

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.toastWait("Congratulations");
                cy.get(".v-alert").contains("Congratulations").should("exist");

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Submit default, Enable checkbox "Submit another form`, () => {
                // clicking again on view name shows blank still. work around- toggling between two views
                // cy.get(`.nc-view-item.nc-grid-view-item`)
                //     .contains("Country")
                //     .click();
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .click();

                // fill up mandatory fields
                cy.get("#data-table-form-Country").type("_abc");
                cy.get("#data-table-form-LastUpdate").click();
                cy.getActiveModal().find("button").contains("19").click();
                cy.getActiveModal().find("button").contains("OK").click();

                // enable "Submit another form" check box
                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(0)
                    .click();

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.toastWait("Congratulations");
                cy.get(".v-alert").contains("Congratulations").should("exist");
                cy.get("button")
                    .contains("Submit Another Form")
                    .should("exist");

                cy.get("button").contains("Submit Another Form").click();
                cy.get(".nc-form").should("exist");
                // New form appeared? Header & description should exist
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Submit default, Enable checkbox "blank form after 5 seconds"`, () => {
                // cy.get(`.nc-view-item.nc-grid-view-item`)
                //     .contains("Country")
                //     .click();
                // cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                //     .contains("Country1")
                //    .click();

                cy.get("#data-table-form-Country").type("_abc");
                cy.get("#data-table-form-LastUpdate").click();
                cy.getActiveModal().find("button").contains("19").click();
                cy.getActiveModal().find("button").contains("OK").click();

                // enable "New form after 5 seconds" button
                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(0)
                    .click({ force: true });
                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(1)
                    .click();

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.toastWait("Congratulations");
                cy.get(".v-alert")
                    .contains("Congratulations")
                    .should("exist")
                    .then(() => {
                        // wait for 5 seconds
                        cy.get(".nc-form").should("exist");

                        // validate if form has appeared again
                        cy.get(".nc-form")
                            .find('[placeholder="Form Title"]')
                            .contains("A B C D")
                            .should("exist");
                        cy.get(".nc-form")
                            .find('[placeholder="Add form description"]')
                            .contains("Some description about form comes here")
                            .should("exist");
                    });

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Email me verification, without SMTP configuration`, () => {
                // open formview & enable "email me" option
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .click();

                // wait for 5 seconds
                cy.get(".nc-form").should("exist");

                // validate if form has appeared again
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");

                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(2)
                    .click({ force: true });
                // validate if toaster pops up requesting to activate SMTP
                cy.toastWait(
                    "Please activate SMTP plugin in App store for enabling email notification"
                );

                cy.wait(1000);
            });

            it(`Validate ${viewType}: Email me verification, with SMTP configuration`, () => {
                // activate SMTP, dummy profile
                mainPage.navigationDraw(mainPage.APPSTORE).click();
                mainPage.configureSMTP(
                    "admin@ex.com",
                    "smtp.ex.com",
                    "8080",
                    "TLS"
                );

                // open form view & enable "email me" option
                cy.openTableTab("Country", 25);

                cy.wait(1000);

                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .click();

                // validate if form has appeared again
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");

                cy.get(".nc-form > .mx-auto")
                    .find('[type="checkbox"]')
                    .eq(2)
                    .click({ force: true });
                // validate if toaster pops up informing installation of email notification
                // cy.get('.toasted:visible', { timout: 6000 })
                //     .contains('Successfully installed and email notification will use SMTP configuration')
                //     .should('exist')
                // reset SMPT config's
                mainPage.navigationDraw(mainPage.APPSTORE).click();
                mainPage.resetSMTP();

                cy.wait(3000);

                cy.openTableTab("Country", 25);
            });

            it(`Validate ${viewType}: Add/ remove field verification"`, () => {
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .click();

                cy.wait(3000);

                // validate if form has appeared again
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");

                cy.get("#data-table-form-LastUpdate").should("exist");
                // remove "LastUpdate field"
                cy.get(".nc-form").find(".nc-field-remove-icon").eq(2).click();
                cy.get("#data-table-form-LastUpdate").should("not.exist");
                cy.get(".col-md-4")
                    .find(".pointer.item")
                    .contains("LastUpdate")
                    .should("exist");

                // add it back
                cy.get(".col-md-4")
                    .find(".pointer.item")
                    .contains("LastUpdate")
                    .click();
                cy.get("#data-table-form-LastUpdate").should("exist");

                cy.wait(3000);
            });

            it(`Validate ${viewType}: URL verification`, () => {
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Country1")
                    .click();

                // validate if form has appeared again
                cy.get(".nc-form")
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");

                // verify URL & copy it for subsequent test
                cy.url().should("contain", `&view=vw_`);
                cy.url().then((url) => {
                    cy.log(url);
                    formViewURL = url;
                });

                cy.wait(3000);
            });

            it(`Validate ${viewType}: URL validation after re-access`, () => {
                // visit URL
                cy.log(formViewURL);
                cy.visit(formViewURL, {
                    baseUrl: null,
                });
                cy.wait(5000);

                // New form appeared? Header & description should exist
                cy.get(".nc-form", { timeout: 10000 })
                    .find('[placeholder="Form Title"]')
                    .contains("A B C D")
                    .should("exist");
                cy.get(".nc-form", { timeout: 10000 })
                    .find('[placeholder="Add form description"]')
                    .contains("Some description about form comes here")
                    .should("exist");
            });

            it(`Delete ${viewType} view`, () => {
                // number of view entries should be 2 before we delete
                cy.get(".nc-view-item").its("length").should("eq", 2);

                // click on delete icon (becomes visible on hovering mouse)
                cy.get(".nc-view-delete-icon").click({ force: true });
                cy.toastWait("View deleted successfully");

                // confirm if the number of veiw entries is reduced by 1
                cy.get(".nc-view-item").its("length").should("eq", 1);

                // clean up newly added rows into Country table operations
                // this auto verifies successfull addition of rows to table as well
                mainPage.getPagination(5).click();
                cy.get(".nc-grid-row").should("have.length", 13);
                mainPage
                    .getRow(10)
                    .find(".mdi-checkbox-blank-outline")
                    .click({ force: true });
                mainPage
                    .getRow(11)
                    .find(".mdi-checkbox-blank-outline")
                    .click({ force: true });
                mainPage
                    .getRow(12)
                    .find(".mdi-checkbox-blank-outline")
                    .click({ force: true });
                mainPage
                    .getRow(13)
                    .find(".mdi-checkbox-blank-outline")
                    .click({ force: true });

                mainPage.getCell("Country", 10).rightclick();
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
