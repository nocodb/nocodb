import {
    isTestSuiteActive,
    roles,
} from "../../support/page_objects/projectConstants";
import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";

let independentSuite = true

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
    Duration: "60",
};

// links/ computed fields
let records2 = {
    Done: true,
    Date: "2022-05-31",
    Rating: "1",
    Actor: ["Actor1", "Actor2"],
    "Status (from Actor)": ["Todo", "In progress"],
    RollUp: "128",
    Computation: "4.04",
    Producer: ["P1", "P2"]
};

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

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;
    describe(`Webhook`, () => {
        before(() => {
            if(independentSuite) {
                cy.waitForSpinners();
                cy.signinOrSignup(roles.owner.credentials);
            }
            else {
                loginPage.signIn(roles.owner.credentials);
            }
            projectsPage.openProject("sample");
        });

        after(() => {});

        it("Verify Data types", () => {
            cy.openTableTab("Film", 3);

            // normal cells
            for (let [key, value] of Object.entries(records)) {
                mainPage.getCell(key, 1).contains(value).should("exist");
            }

            // checkbox
            mainPage
                .getCell("Done", 1)
                .find(".mdi-check-circle-outline")
                .should(records2.Done ? "exist" : "not.exist");

            // date

            // rating
            mainPage
                .getCell("Rating", 1)
                .find("button.mdi-star")
                .should("have.length", records2.Rating);

            // LinkToAnotherRecord
            mainPage.getCell("Actor", 1).scrollIntoView();
            cy.get(
                ':nth-child(1) > [data-col="Actor"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name'
            )
                .contains(records2.Actor[0])
                .should("exist");
            cy.get(
                ':nth-child(1) > [data-col="Actor"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(2) > .v-chip__content > .name'
            )
                .contains(records2.Actor[1])
                .should("exist");
            // mainPage.getCell("Actor", 1).find(".nc-virtual-cell > .v-lazy > .d-100 > .chips").eq(0).contains("Actor1").should('exist')
            // mainPage.getCell("Actor", 1).find(".nc-virtual-cell > .v-lazy > .d-100 > .chips").eq(1).contains("Actor2").should('exist')

            // lookup
            mainPage.getCell("Status (from Actor)", 1).scrollIntoView();
            cy.get(
                ':nth-child(1) > [data-col="Status (from Actor)"] > .nc-virtual-cell > .v-lazy > .d-flex > :nth-child(1) > .v-chip__content > div > .set-item'
            )
                .contains(records2["Status (from Actor)"][0])
                .should("exist");
            cy.get(
                ':nth-child(1) > [data-col="Status (from Actor)"] > .nc-virtual-cell > .v-lazy > .d-flex > :nth-child(2) > .v-chip__content > div > .set-item'
            )
                .contains(records2["Status (from Actor)"][1])
                .should("exist");

            // rollup
            mainPage.getCell("RollUp", 1).scrollIntoView();
            // cy.get(':nth-child(1) > [data-col="RollUp"] > .nc-virtual-cell > .v-lazy > span').contains(records2.RollUp).should('exist')
            cy.get(`:nth-child(1) > [data-col="RollUp"] > .nc-virtual-cell`)
                .contains(records2.RollUp)
                .should("exist");

            // formula
            mainPage.getCell("Computation", 1).scrollIntoView();
            cy.get(
                `:nth-child(1) > [data-col="Computation"] > .nc-virtual-cell`
            )
                .contains(records2.Computation)
                .should("exist");

            // ltar hm relation
            mainPage.getCell("Producer", 1).scrollIntoView();
            cy.get(
              ':nth-child(1) > [data-col="Producer"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name'
            )
              .contains(records2.Producer[0])
              .should("exist");
            cy.get(
              ':nth-child(1) > [data-col="Producer"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(2) > .v-chip__content > .name'
            )
              .contains(records2.Producer[1])
              .should("exist");

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
            cy.get(".nc-grid-header-cell").contains('Attachments').should("not.be.visible");
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
              .contains('A -> Z')
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
        })
    });
};

genTest("rest", "xcdb");

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
