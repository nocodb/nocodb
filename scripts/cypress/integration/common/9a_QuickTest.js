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
  Producer: ["P1", "P2"],
};

let tn = ["Film", "Actor", "Producer"];

let cn = [
  "Name",
  "Notes",
  "Status",
  "Tags",
  "Done",
  "Date",
  "Phone",
  "Email",
  "URL",
  "Number",
  "Percent",
  "Duration",
  "Rating",
  "Actor",
  "Status (from Actor)",
  "RollUp",
  "Computation",
  "Producer",
];

function openWebhook(index) {
  // http://localhost:8080/api/v1/db/meta/tables/md_dx81kkfdso115u/hooks
  cy.intercept("GET", "/api/v1/db/meta/tables/*/hooks").as("getHooks");

  cy.get(".nc-actions-menu-btn").should("exist").click();
  cy.getActiveMenu(".nc-dropdown-actions-menu")
    .find(".ant-dropdown-menu-title-content")
    .contains("Webhooks")
    .click();

  cy.wait("@getHooks");

  cy.get(`.nc-hook:eq(${index})`).should("exist").click();
}

// to be invoked after open
function verifyWebhook(config) {
  cy.get(".nc-text-field-hook-title").then(($element) => {
    expect($element[0].value).to.have.string(config.title);
  });
  cy.get(".nc-text-field-hook-event")
    .find(".ant-select-selection-item")
    .contains(config.event)
    .should("exist");
  cy.get(".nc-select-hook-notification-type")
    .find(".ant-select-selection-item")
    .contains(config.notification)
    .should("exist");
  cy.get(".nc-select-hook-url-method")
    .find(".ant-select-selection-item")
    .contains(config.type)
    .should("exist");
  cy.get(".nc-text-field-hook-url-path").then(($element) => {
    expect($element[0].value).to.have.string(config.url);
  });
  cy.get(".nc-icon-hook-navigate-left").click({ force: true });
}

export const genTest = (apiType, dbType, testMode) => {
  let clear;

  if (!isTestSuiteActive(apiType, dbType)) return;
  describe(`Quick Tests`, () => {
    let cellIdx = 1;
    let columnCount = cn.length;
    if (testMode === "AT_IMPORT") {
      cellIdx = 3;
      columnCount -= 3;
    }

    before(() => {
      if (testMode === "CY_QUICK") {
        // cy.task("copyFile")
        loginPage.signIn(roles.owner.credentials);
        projectsPage.openProject("sample");

        // kludge: wait for page load to finish
        cy.wait(2000);
        // close team & auth tab
        cy.get("button.ant-tabs-tab-remove").should("exist").click();
        cy.wait(1000);
      } else {
        cy.restoreLocalStorage();
      }

      cy.openTableTab("Film", 3);
      cy.saveLocalStorage();

      clear = Cypress.LocalStorage.clear;
      Cypress.LocalStorage.clear = () => {};
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      cy.restoreLocalStorage();
      cy.signOut();
      cy.saveLocalStorage();

      Cypress.LocalStorage.clear = clear;
    });

    it("Verify Schema", () => {
      // verify if all tables exist
      for (let i = 0; i < tn.length; i++) {
        cy.get(`.nc-project-tree-tbl-${tn[i]}`).should("exist");
      }

      // for Film table, verify columns
      for (let i = 0; i < columnCount; i++) {
        cy.get(`th[data-title="${cn[i]}"]`).should("exist");
      }
    });

    it("Verify Data types", () => {
      // normal cells
      for (let [key, value] of Object.entries(records)) {
        mainPage.getCell(key, cellIdx).contains(value).should("exist");
      }

      // checkbox
      mainPage
        .getCell("Done", cellIdx)
        .find(".nc-cell-hover-show")
        .should(records2.Done ? "not.exist" : "exist");

      // date

      // duration
      mainPage
        .getCell("Duration", cellIdx)
        .contains(records2.Duration)
        .should("exist");

      // rating
      mainPage
        .getCell("Rating", cellIdx)
        .find(".ant-rate-star-full")
        .should("have.length", records2.Rating);

      // verifying only one instance as its different for PG & SQLite
      // for PG: its Actor1, Actor1
      // for SQLite: its Actor1, Actor2
      // LinkToAnotherRecord
      mainPage.getCell("Actor", cellIdx).scrollIntoView();
      cy.get(`:nth-child(${cellIdx}) > [data-title="Actor"]`)
        .find(".chip")
        .eq(0)
        .contains(records2.Actor[0])
        .should("exist");

      // lookup
      mainPage.getCell("Status (from Actor)", cellIdx).scrollIntoView();
      cy.get(`:nth-child(${cellIdx}) > [data-title="Status (from Actor)"]`)
        .find(".nc-cell")
        .eq(0)
        .contains(records2["Status (from Actor)"][0])
        .should("exist");

      // rollup
      if (testMode === "CY_QUICK") {
        mainPage.getCell("RollUp", cellIdx).scrollIntoView();
        mainPage
          .getCell("RollUp", cellIdx)
          .contains(records2.RollUp)
          .should("exist");

        // formula
        mainPage.getCell("Computation", cellIdx).scrollIntoView();
        mainPage
          .getCell("Computation", cellIdx)
          .contains(records2.Computation)
          .should("exist");

        // ltar hm relation
        mainPage.getCell("Producer", cellIdx).scrollIntoView();
        mainPage
          .getCell("Producer", cellIdx)
          .find(".chip")
          .eq(0)
          .contains(records2.Producer[0])
          .should("exist");
        mainPage
          .getCell("Producer", cellIdx)
          .find(".chip")
          .eq(1)
          .contains(records2.Producer[1])
          .should("exist");
      }
    });

    it("Verify Views & Shared base", () => {
      cy.get(".nc-form-view-item:visible")
        .should("exist")
        .eq(0)
        .click({ force: true });

      // Header & description should exist
      // cy.get(".nc-form")
      //   .find('[placeholder="Form Title"]')
      //   .contains("FormTitle")
      //   .should("exist");
      // cy.get(".nc-form")
      //   .find('[placeholder="Add form description"]')
      //   .contains("FormDescription")
      //   .should("exist");

      cy.get(".nc-form").should("exist");

      cy.get(".nc-form")
        .find('[placeholder="Form Title"]')
        .should("exist")
        .then(($el) => {
          cy.log($el);
          expect($el.val()).to.equal("FormTitle");
        });
      cy.get(".nc-form")
        .find('[placeholder="Add form description"]')
        .should("exist")
        .then(($el) => {
          cy.log($el);
          expect($el.val()).to.equal("FormDescription");
        });

      // modified column name & help text
      cy.get(".nc-editable")
        .eq(0)
        .find(".name")
        .contains("DisplayName")
        .should("exist");
      cy.get(".nc-editable")
        .eq(0)
        .find(".text-gray-500")
        .contains("HelpText")
        .should("exist");

      cy.get(".nc-editable")
        .eq(1)
        .find(".name")
        .contains("Email")
        .should("exist");

      // add message
      cy.get("textarea.nc-form-after-submit-msg").then(($element) => {
        expect($element[0].value).to.have.string(
          "Thank you for submitting the form!"
        );
      });
      // cy.get(".nc-form > .mx-auto")
      //   .find("textarea").then(($element) => {
      //       expect($element[0].value).to.have.string("Thank you for submitting the form!")
      // })

      cy.get(
        "button.nc-form-checkbox-submit-another-form.ant-switch-checked"
      ).should("exist");
      cy.get(
        "button.nc-form-checkbox-show-blank-form.ant-switch-checked"
      ).should("exist");
      cy.get("button.nc-form-checkbox-send-email.ant-switch-checked").should(
        "not.exist"
      );

      // // submit another form button
      // cy.get(".nc-form > .mx-auto")
      //   .find('[type="checkbox"]')
      //   .eq(0)
      //   .should('be.checked')
      // // "New form after 5 seconds" button
      // cy.get(".nc-form > .mx-auto")
      //   .find('[type="checkbox"]')
      //   .eq(1)
      //   .should('be.checked')
      // // email me
      // cy.get(".nc-form > .mx-auto")
      //   .find('[type="checkbox"]')
      //   .eq(2)
      //   .should('not.be.checked')

      cy.closeTableTab("Film");
    });

    it("Verify Webhooks", () => {
      if (testMode === "CY_QUICK") {
        cy.openTableTab("Actor", 25);
        openWebhook(0);
        verifyWebhook({
          title: "Webhook-1",
          event: "After Insert",
          notification: "URL",
          type: "POST",
          url: "http://localhost:9090/hook",
          condition: false,
        });
        cy.get("body").type("{esc}");

        openWebhook(1);
        verifyWebhook({
          title: "Webhook-2",
          event: "After Update",
          notification: "URL",
          type: "POST",
          url: "http://localhost:9090/hook",
          condition: false,
        });
        cy.get("body").type("{esc}");

        openWebhook(2);
        verifyWebhook({
          title: "Webhook-3",
          event: "After Delete",
          notification: "URL",
          type: "POST",
          url: "http://localhost:9090/hook",
          condition: false,
        });
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
        .should("have.class", "ant-pagination-item-active");

      // verify < pagination option
      mainPage.getPagination("<").click();
      mainPage
        .getPagination(1)
        .should("have.class", "ant-pagination-item-active");

      cy.closeTableTab("Actor");
    });

    it("Verify Fields, Filter & Sort", () => {
      cy.openTableTab("Actor", 25);

      cy.get(".nc-grid-view-item").eq(1).click();

      cy.wait(3000);

      cy.get(".nc-grid-header")
        .find(`th[data-title="Name"]`)
        .should("be.visible");
      cy.get(".nc-grid-header")
        .find(`th[data-title="Notes"]`)
        .should("be.visible");
      cy.get(".nc-grid-header")
        .find(`th[data-title="Attachments"]`)
        .should("not.exist");
      cy.get(".nc-grid-header")
        .find(`th[data-title="Status"]`)
        .should("be.visible");
      cy.get(".nc-grid-header")
        .find(`th[data-title="Film"]`)
        .should("be.visible");

      cy.wait(2000);
      cy.get(".nc-fields-menu-btn").click();

      cy.getActiveMenu(".nc-dropdown-fields-menu")
        .find(`[type="checkbox"]`)
        .eq(0)
        .should("be.checked");
      cy.getActiveMenu(".nc-dropdown-fields-menu")
        .find(`[type="checkbox"]`)
        .eq(1)
        .should("be.checked");
      cy.getActiveMenu(".nc-dropdown-fields-menu")
        .find(`[type="checkbox"]`)
        .eq(2)
        .should("not.be.checked");
      cy.getActiveMenu(".nc-dropdown-fields-menu")
        .find(`[type="checkbox"]`)
        .eq(3)
        .should("be.checked");
      cy.getActiveMenu(".nc-dropdown-fields-menu")
        .find(`[type="checkbox"]`)
        .eq(4)
        .should("be.checked");
      cy.get(".nc-fields-menu-btn").click();

      cy.get(".nc-sort-menu-btn").click();
      cy.get(".nc-sort-field-select").eq(0).contains("Name").should("exist");
      cy.get(".nc-sort-dir-select").eq(0).contains("A → Z").should("exist");
      cy.get(".nc-sort-menu-btn").click();

      cy.get(".nc-filter-menu-btn").click();
      cy.get(".nc-filter-field-select").eq(0).contains("Name").should("exist");
      cy.get(".nc-filter-operation-select")
        .eq(0)
        .contains("is like")
        .should("exist");

      cy.get(".nc-filter-field-select").eq(1).contains("Name").should("exist");
      cy.get(".nc-filter-operation-select")
        .eq(1)
        .contains("is like")
        .should("exist");
      cy.get(".nc-filter-menu-btn").click();

      cy.closeTableTab("Actor");
    });

    it("Views, bt relation", () => {
      if (testMode === "CY_QUICK") {
        cy.openTableTab("Producer", 3);

        cy.get(".nc-grid-view-item").should("have.length", 4);
        cy.get(".nc-form-view-item").should("have.length", 4);
        cy.get(".nc-gallery-view-item").should("have.length", 3);

        // LinkToAnotherRecord hm relation
        mainPage.getCell("FilmRead", 1).scrollIntoView();
        cy.get(
          '[data-title="FilmRead"] > .h-full > .nc-virtual-cell > .w-full > .chips > .chip > .name'
        )
          // cy.get(
          //   ':nth-child(1) > [data-col="FilmRead"] > .nc-virtual-cell > .v-lazy > .d-100 > .chips > :nth-child(1) > .v-chip__content > .name'
          // )
          .contains("Movie-1")
          .should("exist");

        cy.closeTableTab("Producer");
      }
    });

    it.skip("Delete Project", () => {
      if (testMode === "AT_IMPORT") {
        mainPage.toolBarTopLeft(mainPage.HOME).click({ force: true });
        cy.get(`.mdi-delete-outline`, {
          timeout: 10000,
        })
          .should("exist")
          .last()
          .click();

        cy.getActiveModal(".nc-modal-project-delete")
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
