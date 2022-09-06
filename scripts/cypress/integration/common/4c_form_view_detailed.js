import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage, settingsPage } from "../../support/page_objects/mainPage";
import {loginPage} from "../../support/page_objects/navigation";

let formViewURL;

function verifyFormDrawerFieldLocation(fieldName, position) {
    cy.get(".nc-editable.item")
      .eq(position)
      .contains(fieldName)
      .should("exist");
}

function verifyFormDrawerHideObjectCount(count) {
    if(count) {
        cy.get(".nc-form")
            .find(".nc-field-remove-icon")
            .its("length")
            .should("eq", count);
    } else {
        cy.get(".nc-form")
            .find(".nc-field-remove-icon")
            .should("not.exist");
    }
}

function verifyFormMenuDrawerCardCount(cardCount) {
    if(cardCount) {
        cy.get('.nc-form-left-drawer').find('.ant-card').should('have.length', cardCount);
    } else {
        cy.get('.nc-form-left-drawer').find('.ant-card').should('not.exist');
    }
}

function validateFormHeader() {
    cy.get(".nc-form").should("exist");

    cy.get(".nc-form")
      .find('[placeholder="Form Title"]')
      .should("exist").then(($el) => {
        cy.log($el)
        expect($el.val()).to.equal("A B C D");
    })
    cy.get(".nc-form")
      .find('[placeholder="Add form description"]')
      .should("exist").then(($el) => {
        cy.log($el)
        expect($el.val()).to.equal("Some description about form comes here");
    })
}

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} api - FORM view`, () => {
        const name = "Test" + Date.now();

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            mainPage.tabReset();
            // loginPage.loginAndOpenProject(apiType, dbType);

            // kludge: wait for page load to finish
            cy.wait(2000);
            // close team & auth tab
            cy.get('button.ant-tabs-tab-remove').should('exist').click();
            cy.wait(1000);

            // open a table to work on views
            //
            cy.openTableTab("Country", 25);
            mainPage.toggleRightSidebar();

            cy.saveLocalStorage();
            cy.wait(500);
        });

        beforeEach(() => {
            // fix me!
            // window.localStorage.setItem('nc-right-sidebar', '{"isOpen":true,"hasSidebar":true}')
            cy.restoreLocalStorage();
            cy.wait(500);
        });

        afterEach(() => {
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

                // validate if view was creted && contains default name 'Form-1'
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .should("exist");
            });

            it(`Validate ${viewType} view: Drag & drop for re-order items`, () => {
                // default order: Country, LastUpdate, Country => City
                verifyFormDrawerFieldLocation("Country", 0);
                verifyFormDrawerFieldLocation("LastUpdate", 1);

                // move Country field down (drag, drop)
                cy.get(".nc-form-drag-LastUpdate").drag(
                    ".nc-form-drag-Country"
                );
                cy.wait(1000);

                // Verify if order is: LastUpdate, Country, Country => City
                verifyFormDrawerFieldLocation("LastUpdate", 0);
                verifyFormDrawerFieldLocation("Country", 1);
            });

            it(`Validate ${viewType} view: Drag & drop for add/remove items`, () => {
                // default, only one item in menu-bar; ensure LastUpdate field was present in form view
                verifyFormMenuDrawerCardCount(0)
                verifyFormDrawerFieldLocation("LastUpdate", 0);

                // drag 'LastUpdate' & drop into menu bar drag-drop box
                cy.get(".nc-form-drag-LastUpdate").drag(
                    ".nc-drag-n-drop-to-hide"
                );

                // validate- fields count in menu bar to be increased by 1 &&
                // first member in 'formView' is Country
                verifyFormDrawerFieldLocation("Country", 0);
                verifyFormMenuDrawerCardCount(1);
            });

            it(`Validate ${viewType} view: Inverted order field member addition from menu`, () => {

                cy.get(".nc-form-remove-all").click();
                verifyFormMenuDrawerCardCount(2)

                // click fields in inverted order: LastUpdate, Country => City
                cy.get('.nc-form-left-drawer').find('.ant-card').eq(1).click();

                verifyFormMenuDrawerCardCount(1);
                cy.get('.nc-form-left-drawer').find('.ant-card').eq(0).click();

                // verify if order of appearance in form is right
                // Country was never removed as its required field. Other two will appear in inverted order
                verifyFormMenuDrawerCardCount(0);
                verifyFormDrawerFieldLocation("Country", 0);
                verifyFormDrawerFieldLocation("City List", 1);
                verifyFormDrawerFieldLocation("LastUpdate", 2);
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
                    .clear()
                    .type("A B C D");
                cy.get(".nc-form")
                    .find('[placeholder="Add form description"]')
                    .type("Some description about form comes here");

                cy.get(".nc-form").click()

                // validate new contents
                validateFormHeader();
            });

            it(`Validate ${viewType}: Add all, Remove all validation`, () => {

                // ensure buttons exist on left hand menu
                cy.get(".nc-form-left-drawer").find(".nc-form-add-all").should("not.exist");
                cy.get(".nc-form-left-drawer").find(".nc-form-remove-all").should("be.visible");

                // click: remove-all
                cy.get(".nc-form-left-drawer").find(".nc-form-remove-all").click();
                cy.wait(1000);
                // form should not contain any "field remove icons"
                verifyFormDrawerHideObjectCount(0);
                // menu bar should contain 2 .pointer.item (LastUpdate, County->City)
                verifyFormMenuDrawerCardCount(2);

                // click: Add all
                cy.get(".nc-form-left-drawer").find(".nc-form-add-all").should('be.visible').click();
                cy.get(".nc-form-left-drawer").find(".nc-form-remove-all").should("be.visible");

                // form should contain "field remove icons"
                verifyFormDrawerHideObjectCount(2);

                // menu bar should not contain .pointer.item (column name/ field name add options)
                verifyFormMenuDrawerCardCount(0);
            });

            it(`Validate ${viewType}: Submit default, empty show this message textbox`, () => {
                // fill up mandatory fields
                cy.get(".nc-form-input-Country").type("_abc");
                cy.get(".nc-form-input-LastUpdate").click();
                cy.get(".ant-picker-now-btn:visible").contains("Now").click();
                cy.get(".ant-btn-primary:visible").contains("Ok").click();

                // default message, no update

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();

                cy.get(".ant-alert-message")
                    .contains("Successfully submitted form data")
                    .should("exist");

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Submit default, with valid Show message entry`, () => {
                // clicking again on view name shows blank still. work around- toggling between two views
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .click();

                // fill up mandatory fields
                cy.get(".nc-form-input-Country").should('exist').type("_abc");
                cy.get(".nc-form-input-LastUpdate").click();
                cy.get(".ant-picker-now-btn:visible").contains("Now").click();
                cy.get(".ant-btn-primary:visible").contains("Ok").click();

                // add message
                cy.get("textarea.nc-form-after-submit-msg")
                    .type("Congratulations!");

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.get(".ant-alert-message").contains("Congratulations!").should("exist");

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Submit default, Enable checkbox "Submit another form`, () => {
                // clicking again on view name shows blank still. work around- toggling between two views
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .click();

                // fill up mandatory fields
                cy.get(".nc-form-input-Country").type("_abc");
                cy.get(".nc-form-input-LastUpdate").click();
                cy.get(".ant-picker-now-btn:visible").contains("Now").click();
                cy.get(".ant-btn-primary:visible").contains("Ok").click();

                // enable "Submit another form" check box
                cy.get("button.nc-form-checkbox-submit-another-form").click();

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.get(".ant-alert-message").contains("Congratulations").should("exist");
                cy.get("button")
                    .contains("Submit Another Form")
                    .should("exist")
                    .click();

                // New form appeared? Header & description should exist
                validateFormHeader();

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Submit default, Enable checkbox "blank form after 5 seconds"`, () => {

                cy.get(".nc-form-input-Country").type("_abc");
                cy.get(".nc-form-input-LastUpdate").click();
                cy.get(".ant-picker-now-btn:visible").contains("Now").click();
                cy.get(".ant-btn-primary:visible").contains("Ok").click();

                // enable "New form after 5 seconds" button
                cy.get("button.nc-form-checkbox-submit-another-form")
                    .click();
                cy.get("button.nc-form-checkbox-show-blank-form")
                    .click();

                // submit button & validate
                cy.get(".nc-form").find("button").contains("Submit").click();
                cy.get(".ant-alert-message")
                    .contains("Congratulations")
                    .should("exist")
                    .then(() => {
                        // validate if form has appeared again
                        validateFormHeader();
                    });

                // end of test removes newly added rows from table. that step validates if row was successfully added.
            });

            it(`Validate ${viewType}: Email me verification, without SMTP configuration`, () => {
                // open formview & enable "email me" option
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .click();

                // validate if form has appeared again
                cy.wait(1000);
                validateFormHeader();
                cy.get(".nc-form-remove-all").click();

                cy.get(".nc-form-checkbox-send-email").click();
                // validate if toaster pops up requesting to activate SMTP
                cy.toastWait(
                    "Please activate SMTP plugin in App store for enabling email notification"
                );
            });

            it(`Validate ${viewType}: Email me verification, with SMTP configuration`, () => {
                // activate SMTP, dummy profile
                settingsPage.openMenu(settingsPage.APPSTORE)
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
                    .contains("Form-1")
                    .click();

                // validate if form has appeared again
                validateFormHeader();

                cy.get(".nc-form-checkbox-send-email")
                    .click();

                settingsPage.openMenu(settingsPage.APPSTORE)
                mainPage.resetSMTP();

                cy.wait(300);
                cy.openTableTab("Country", 25);
            });

            it(`Validate ${viewType}: Add/ remove field verification"`, () => {
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .click();
                cy.get(".nc-form-add-all").click();

                cy.wait(300);

                // validate if form has appeared again
                validateFormHeader();

                cy.get(".nc-form-input-LastUpdate").should("exist");
                // remove "LastUpdate field"
                cy.get(".nc-form").find(".nc-field-remove-icon").eq(1).click();
                cy.get(".nc-form-input-LastUpdate").should("not.exist");

                cy.get('.nc-form-left-drawer').find('.ant-card').contains('LastUpdate').should('exist').click();
                cy.get(".nc-form-input-LastUpdate").should("exist");

                cy.wait(300);
            });

            it(`Validate ${viewType}: URL verification`, () => {
                cy.get(`.nc-view-item.nc-${viewType}-view-item`)
                    .contains("Form-1")
                    .click();

                // validate if form has appeared again
                validateFormHeader();

                // verify URL & copy it for subsequent test
                cy.url().should("contain", `Country/Form-1`);
                cy.url().then((url) => {
                    cy.log(url);
                    formViewURL = url;
                });

                cy.wait(300);
            });

            it.skip(`Validate ${viewType}: URL validation after re-access`, () => {
                // visit URL
                cy.log(formViewURL);

                cy.visit(formViewURL, {
                    baseUrl: null,
                });

                // New form appeared? Header & description should exist
                validateFormHeader();
            });

            it(`Delete ${viewType} view`, () => {
                // cy.visit("/");
                // cy.wait(5000);
                // projectsPage.openConfiguredProject(apiType, dbType);
                // cy.openTableTab("Country", 25);

                // number of view entries should be 2 before we delete
                cy.get(".nc-view-item").its("length").should("eq", 2);

                // click on delete icon (becomes visible on hovering mouse)
                cy.get(".nc-view-delete-icon").click({ force: true });
                cy.wait(1000)
                cy.getActiveModal().find('.ant-btn-dangerous').click();
                cy.toastWait("View deleted successfully");

                // confirm if the number of veiw entries is reduced by 1
                cy.get(".nc-view-item").its("length").should("eq", 1);

                // clean up newly added rows into Country table operations
                // this auto verifies successfull addition of rows to table as well
                mainPage.getPagination(5).click();

                cy.get(".nc-grid-row").should("have.length", 13);
                cy.get(".ant-checkbox").should('exist').eq(10).click({ force: true });
                cy.get(".ant-checkbox").should('exist').eq(11).click({ force: true });
                cy.get(".ant-checkbox").should('exist').eq(12).click({ force: true });
                cy.get(".ant-checkbox").should('exist').eq(13).click({ force: true });

                mainPage.getCell("Country", 10).rightclick({ force: true });
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
