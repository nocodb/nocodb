import {
    isTestSuiteActive,
    roles,
} from "../../support/page_objects/projectConstants";
import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";

// normal fields
let records = {
    Name: "Movie-1",
    Notes: "Good",
    Status: "Todo",
    Tags: "Jan",
    Phone: "123123123",
    Email: "a@b.com",
    URL: "www.a.com",
    Number: "1",
    Value: "$1.00",
    Percent: "0.01",
};

// links/ computed fields
let records2 = {
    Duration: "00:01",
    Done: true,
    Date: "2022-05-31",
    Rating: "1",
    Actor: ["Actor1", "Actor2"],
    "Status (from Actor)": ["Todo", "In progress"],
    RollUp: "128",
    Computation: "4.04",
    Producer: ["P1", "P2"]
};

let tn = [ "Film", "Actor", "Producer", ]

let cn = [ "Name", "Notes", "Status", "Tags", "Done", "Date", "Phone",
    "Email", "URL", "Number", "Percent", "Duration", "Rating",
    "Actor", "Status (from Actor)", "RollUp", "Computation", "Producer" ]

function openWebhook(index) {
    cy.get(".nc-btn-webhook").should("exist").click();
    cy.get(".nc-hook").eq(index).click({ force: true });
}

// to be invoked after open
function verifyWebhook(config) {
    cy.get(".nc-text-field-hook-title")
      .find('input').then(($element) => {
        expect($element[0].value).to.have.string(config.title)
    })
    cy.get(".nc-text-field-hook-event")
      .find('.v-select__selection')
      .contains(config.event)
      .should('exist')
    cy.get(".nc-text-field-hook-notification-type")
      .find('.v-select__selection')
      .contains(config.notification)
      .should('exist')
    cy.get('.nc-select-hook-url-method')
      .find('.v-select__selection')
      .contains(config.type)
      .should('exist')
    cy.get(".nc-text-field-hook-url-path")
      .find('input').then(($element) => {
        expect($element[0].value).to.have.string(config.url)
    })
    cy.get(".nc-icon-hook-navigate-left").click({force:true})
}

export const genTest = (apiType, dbType, testMode) => {
    if (!isTestSuiteActive(apiType, dbType)) return;
    describe(`Quick Tests`, () => {

        let cellIdx = 1;
        let columnCount = cn.length
        if(testMode === 'AT_IMPORT') {
            cellIdx = 3;
            columnCount -= 3;
        }

        before(() => {
            if( testMode === 'CY_QUICK') {
                // cy.task("copyFile")
                loginPage.signIn(roles.owner.credentials);
                projectsPage.openProject("sample");
            }
        });

        after(() => {});

        it("Verify Schema", () => {
            cy.openTableTab("Film", 3)

            // verify if all tables exist
            for(let i=0; i<tn.length; i++)
                cy.get(".nc-project-tree").contains(tn[i]).should('exist')

            // for Film table, verify columns
            for(let i=0; i<columnCount; i++)
                cy.get(".nc-grid-header-row").find(`[data-col="${cn[i]}"]`).should('exist')

        });

        it("Verify Data types", () => {
            cy.openTableTab("Film", 3);

            // normal cells
            for (let [key, value] of Object.entries(records)) {
                mainPage.getCell(key, cellIdx).contains(value).should("exist");
            }

            // checkbox
            mainPage
                .getCell("Done", cellIdx)
                .find(".mdi-check-circle-outline")
                .should(records2.Done ? "exist" : "not.exist");

            // date

            // duration
            mainPage.getCell("Duration", cellIdx).find('input').then(($e) => {
                expect($e[0].value).to.equal(records2.Duration)
            })

            // rating
            mainPage
                .getCell("Rating", cellIdx)
                .find("button.mdi-star")
                .should("have.length", records2.Rating);

            // verifying only one instance as its different for PG & SQLite
            // for PG: its Actor1, Actor1
            // for SQLite: its Actor1, Actor2
            // LinkToAnotherRecord
            mainPage.getCell("Actor", cellIdx).scrollIntoView();
            cy.get(
                `:nth-child(${cellIdx}) > [data-col="Actor"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name`
            )
                .contains(records2.Actor[0])
                .should("exist");
            // cy.get(
            //     `:nth-child(${cellIdx}) > [data-col="Actor"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(2) > .v-chip__content > .name`
            // )
            //     .contains(records2.Actor[1])
            //     .should("exist");

            // lookup
            mainPage.getCell("Status (from Actor)", cellIdx).scrollIntoView();
            cy.get(
                `:nth-child(${cellIdx}) > [data-col="Status (from Actor)"] > .nc-virtual-cell > .v-lazy > .d-flex > :nth-child(1) > .v-chip__content > div > .set-item`
            )
                .contains(records2["Status (from Actor)"][0])
                .should("exist");
            // cy.get(
            //     `:nth-child(${cellIdx}) > [data-col="Status (from Actor)"] > .nc-virtual-cell > .v-lazy > .d-flex > :nth-child(2) > .v-chip__content > div > .set-item`
            // )
            //     .contains(records2["Status (from Actor)"][1])
            //     .should("exist");

            // rollup
            if( testMode === 'CY_QUICK') {

                mainPage.getCell("RollUp", cellIdx).scrollIntoView();
                cy.get(`:nth-child(${cellIdx}) > [data-col="RollUp"] > .nc-virtual-cell`)
                  .contains(records2.RollUp)
                  .should("exist");

                // formula
                mainPage.getCell("Computation", cellIdx).scrollIntoView();
                cy.get(
                  `:nth-child(${cellIdx}) > [data-col="Computation"] > .nc-virtual-cell`
                )
                  .contains(records2.Computation)
                  .should("exist");

                // ltar hm relation
                mainPage.getCell("Producer", cellIdx).scrollIntoView();
                cy.get(
                  `:nth-child(${cellIdx}) > [data-col="Producer"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name`
                )
                  .contains(records2.Producer[0])
                  .should("exist");
                cy.get(
                  `:nth-child(${cellIdx}) > [data-col="Producer"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(2) > .v-chip__content > .name`
                )
                  .contains(records2.Producer[1])
                  .should("exist");
            }

            cy.closeTableTab("Film");
        });

        it("Verify Views & Shared base", () => {
            cy.openTableTab("Film", 3);
            cy.get('.nc-form-view-item').eq(0)
              .click({ force: true })

            // Header & description should exist
            cy.get(".nc-form")
              .find('[placeholder="Form Title"]')
              .contains("FormTitle")
              .should("exist");
            cy.get(".nc-form")
              .find('[placeholder="Add form description"]')
              .contains("FormDescription")
              .should("exist");

            // modified column name & help text
            cy.get(".nc-field-wrapper").eq(0)
              .find('.nc-field-labels')
              .contains("DisplayName")
              .should('exist')
            cy.get(".nc-field-wrapper").eq(0)
              .find('.nc-hint')
              .contains('HelpText')
              .should('exist')

            cy.get(".nc-field-wrapper").eq(1)
              .find('.nc-field-labels')
              .contains("Email")
              .should('exist')

            // add message
            cy.get(".nc-form > .mx-auto")
              .find("textarea").then(($element) => {
                  expect($element[0].value).to.have.string("Thank you for submitting the form!")
            })

            // submit another form button
            cy.get(".nc-form > .mx-auto")
              .find('[type="checkbox"]')
              .eq(0)
              .should('be.checked')
            // "New form after 5 seconds" button
            cy.get(".nc-form > .mx-auto")
              .find('[type="checkbox"]')
              .eq(1)
              .should('be.checked')
            // email me
            cy.get(".nc-form > .mx-auto")
              .find('[type="checkbox"]')
              .eq(2)
              .should('not.be.checked')

            cy.closeTableTab("Film");
        });

        it("Verify Webhooks", () => {
            if( testMode === 'CY_QUICK') {
                cy.openTableTab("Actor", 25);
                openWebhook(0)
                verifyWebhook({
                    title: "Webhook-1",
                    event: "After Insert",
                    notification: "URL",
                    type: "POST",
                    url: "http://localhost:9090/hook",
                    condition: false
                })
                cy.get("body").type("{esc}");

                openWebhook(1)
                verifyWebhook({
                    title: "Webhook-2",
                    event: "After Update",
                    notification: "URL",
                    type: "POST",
                    url: "http://localhost:9090/hook",
                    condition: false
                })
                cy.get("body").type("{esc}");

                openWebhook(2)
                verifyWebhook({
                    title: "Webhook-3",
                    event: "After Delete",
                    notification: "URL",
                    type: "POST",
                    url: "http://localhost:9090/hook",
                    condition: false
                })
                cy.get("body").type("{esc}");

                cy.closeTableTab("Actor");
            }
        });

        it("Pagination", () => {
            cy.openTableTab("Actor", 25);

            cy.get(".nc-pagination").should("exist");

            // verify > pagination option
            mainPage.getPagination(">").click();
            mainPage
              .getPagination(2)
              .should("have.class", "v-pagination__item--active");

            // verify < pagination option
            mainPage.getPagination("<").click();
            mainPage
              .getPagination(1)
              .should("have.class", "v-pagination__item--active");

            cy.closeTableTab("Actor");
        });

        it("Verify Fields, Filter & Sort", () => {
            cy.openTableTab("Actor", 25);
            cy.get(".nc-grid-view-item").eq(1).click()

            cy.get(".nc-grid-header-cell").contains('Name').should("be.visible");
            cy.get(".nc-grid-header-cell").contains('Notes').should("be.visible");
            // fix me!
            if(testMode !== 'AT_IMPORT') cy.get(".nc-grid-header-cell").contains('Attachments').should("not.be.visible");
            cy.get(".nc-grid-header-cell").contains('Status').should("be.visible");
            cy.get(".nc-grid-header-cell").contains('Film').should("be.visible");

            cy.get(".nc-fields-menu-btn").click();
            cy.getActiveMenu().find(`[type="checkbox"]`).eq(0).should('be.checked')
            cy.getActiveMenu().find(`[type="checkbox"]`).eq(1).should('be.checked')
            cy.getActiveMenu().find(`[type="checkbox"]`).eq(2).should('not.be.checked')
            cy.getActiveMenu().find(`[type="checkbox"]`).eq(3).should('be.checked')
            cy.getActiveMenu().find(`[type="checkbox"]`).eq(4).should('be.checked')
            cy.get(".nc-fields-menu-btn").click();

            cy.get(".nc-sort-menu-btn").click();
            cy.get(".nc-sort-field-select").eq(0)
              .contains('Name')
              .should("exist");
            cy.get(".nc-sort-dir-select").eq(0)
              .contains('A → Z')
              .should("exist");
            cy.get(".nc-sort-menu-btn").click();

            cy.get(".nc-filter-menu-btn").click();
            cy.get(".nc-filter-field-select").eq(0)
              .contains('Name')
              .should("exist");
            cy.get(".nc-filter-operation-select").eq(0)
              .contains('is like')
              .should("exist");

            cy.get(".nc-filter-field-select").eq(1)
              .contains('Name')
              .should("exist");
            cy.get(".nc-filter-operation-select").eq(1)
              .contains('is like')
              .should("exist");
            cy.get(".nc-filter-menu-btn").click();

            cy.closeTableTab("Actor");
        });

        it("Views, bt relation", () => {
            if( testMode === 'CY_QUICK') {

                cy.openTableTab("Producer", 3)
                cy.get('.nc-grid-view-item').should('have.length', 4)
                cy.get('.nc-form-view-item').should('have.length', 4)
                cy.get('.nc-gallery-view-item').should('have.length', 3)

                // LinkToAnotherRecord hm relation
                mainPage.getCell("FilmRead", 1).scrollIntoView();
                cy.get(
                  ':nth-child(1) > [data-col="FilmRead"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name'
                )
                  .contains('Movie-1')
                  .should("exist");

                cy.closeTableTab("Producer")
            }
        })

        it("Delete Project", () => {
            if( testMode === 'AT_IMPORT') {
                mainPage.toolBarTopLeft(mainPage.HOME).click({force:true})
                cy.get(`.mdi-delete-outline`, {
                    timeout: 10000,
                })
                  .should("exist")
                  .last()
                  .click();

                cy.getActiveModal()
                  .find("button")
                  .contains("Submit")
                  .should("exist")
                  .click();
                cy.toastWait("deleted successfully");
            }
        });
    });
};

// genTest("rest", "xcdb");

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
