import { isTestSuiteActive } from "../../support/page_objects/projectConstants";
import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";

// locally configured hook (server.js)
let hookPath = "http://localhost:9090/hook";

function createWebhook(hook, test) {
  cy.get(".nc-actions-menu-btn").should("exist").click();
  cy.getActiveMenu(".nc-dropdown-actions-menu")
    .find(".ant-dropdown-menu-title-content")
    .contains("Webhooks")
    .click();

  // cy.get(".nc-btn-webhook").should("exist").click();
  cy.get(".nc-btn-create-webhook").should("exist").click();

  // hardcode "Content-type: application/json"
  cy.get(`.ant-tabs-tab-btn:contains("Headers")`).should("exist").click();

  cy.get(".nc-input-hook-header-key")
    .should("exist")
    .click()
    .type("Content-Type{enter}");

  cy.get("input.nc-input-hook-header-value")
    .should("exist")
    .clear({ force: true })
    .type("application/json", { force: true });

  cy.get(".nc-hook-header-tab-checkbox")
    .find("input.ant-checkbox-input")
    .should("exist")
    .click();

  // common routine for both create & modify to configure hook
  configureWebhook(hook, test);
}

function deleteWebhook(index) {
  cy.get(".nc-actions-menu-btn").should("exist").click();
  cy.getActiveMenu(".nc-dropdown-actions-menu")
    .find(".ant-dropdown-menu-title-content")
    .contains("Webhooks")
    .click();

  cy.get(".nc-hook-delete-icon").eq(index).click({ force: true });
  cy.toastWait("Hook deleted successfully");
  cy.get("body").type("{esc}");
}

function openWebhook(index) {
  cy.get(".nc-actions-menu-btn").should("exist").click();
  cy.getActiveMenu(".nc-dropdown-actions-menu")
    .find(".ant-dropdown-menu-title-content")
    .contains("Webhooks")
    .click();

  cy.get(".nc-hook").eq(index).click({ force: true });
}

function configureWebhook(hook, test) {
  // configure what ever is present. ignore rest
  // currently works for only URL type

  if (hook?.title) {
    cy.get(".nc-text-field-hook-title")
      .should("exist")
      .clear()
      .type(hook.title);
  }

  if (hook?.event) {
    cy.get(".nc-text-field-hook-event").should("exist").click();
    cy.getActiveSelection(".nc-dropdown-webhook-event")
      .find(`.ant-select-item`)
      .contains(hook.event)
      .should("exist")
      .click();
  }

  if (hook?.url?.path) {
    cy.get(".nc-text-field-hook-url-path")
      .should("exist")
      .clear()
      .type(hook.url.path);
  }

  if (hook?.deleteCondition === true) {
    cy.get(".nc-filter-item-remove-btn").should("exist").click({ force: true });
  }

  if (hook?.condition) {
    cy.get(".nc-check-box-hook-condition").should("exist").click();
    cy.get(".menu-filter-dropdown")
      .last()
      .find("button")
      .contains("Add Filter")
      .click();

    cy.get(".nc-filter-field-select").should("exist").last().click();
    cy.get(".ant-select-dropdown:visible")
      .should("exist")
      .find(`.ant-select-item`)
      .contains(new RegExp("^" + hook.condition.column + "$", "g"))
      .should("exist")
      .click();

    cy.get(".nc-filter-operation-select").should("exist").last().click();
    cy.get(".ant-select-dropdown:visible")
      .should("exist")
      .find(`.ant-select-item`)
      .contains(hook.condition.operator)
      .should("exist")
      .click();
    if (
      hook.condition.operator != "is null" &&
      hook.condition.operator != "is not null"
    ) {
      cy.get(".nc-filter-value-select")
        .should("exist")
        .last()
        .type(hook.condition.value);
      cy.get(".nc-filter-operation-select").last().click();
    }
  }

  if (test) {
    cy.get(".nc-btn-webhook-test").should("exist").click();
    cy.toastWait("Webhook tested successfully");
  }

  cy.get(".nc-btn-webhook-save").should("exist").click();
  cy.toastWait("Webhook details updated successfully");
  cy.get(".nc-icon-hook-navigate-left").should("exist").click();
  cy.get("body").type("{esc}");
}

function clearServerData() {
  // clear stored data in server
  cy.request("http://localhost:9090/hook/clear");

  // ensure stored message count is 0
  cy.request("http://localhost:9090/hook/count").then((msg) => {
    cy.log(msg.body);
    expect(msg.body).to.equal(0);
  });
}

function addNewRow(index, cellValue) {
  cy.get(".nc-add-new-row-btn:visible").should("exist");
  cy.get(".nc-add-new-row-btn").click();

  cy.get(".nc-expand-col-Title")
    .should("exist")
    .find(".nc-cell > input")
    .first()
    .type(cellValue);
  cy.getActiveDrawer(".nc-drawer-expanded-form")
    .find(".ant-btn-primary")
    .click();

  cy.toastWait("updated successfully");
  cy.getActiveDrawer(".nc-drawer-expanded-form")
    .find(".ant-btn")
    .contains("Cancel")
    .click();
  mainPage.getCell("Title", index).contains(cellValue).should("exist");
}

function updateRow(index, cellValue) {
  cy.get(".nc-row-expand")
    .eq(index - 1)
    .click({ force: true });

  // wait for page render to complete
  cy.get('button:contains("Save row"):visible').should("exist");

  cy.get(".nc-expand-col-Title")
    .should("exist")
    .find(".nc-cell > input")
    .should("exist")
    .first()
    .clear()
    .type(cellValue);

  cy.getActiveDrawer(".nc-drawer-expanded-form")
    .find("button")
    .contains("Save row")
    .should("exist")
    .click();

  // partial toast message
  cy.toastWait("updated successfully");
  cy.getActiveDrawer(".nc-drawer-expanded-form")
    .find("button")
    .contains("Cancel")
    .click({ force: true });
}

function verifyHookTrigger(count, lastValue) {
  // allow message to be received
  cy.wait(100);

  cy.request("http://localhost:9090/hook/count").then((msg) => {
    cy.log(msg.body);
    expect(msg.body).to.equal(count);
  });
  if (count) {
    cy.request("http://localhost:9090/hook/last").then((msg) => {
      cy.log(msg.body);
      expect(msg.body.Title).to.equal(lastValue);
    });
  }
}

function deleteRow(index) {
  mainPage.getCell("Title", index).rightclick();

  // delete row
  cy.getActiveMenu(".nc-dropdown-grid-context-menu")
    .find('.ant-dropdown-menu-item:contains("Delete Row")')
    .first()
    .click();
}

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;
  describe(`Webhook`, () => {
    before(() => {
      // loginPage.loginAndOpenProject(apiType, dbType);
      cy.restoreLocalStorage();
      cy.createTable("Temp");
      cy.saveLocalStorage();
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    after(() => {
      cy.restoreLocalStorage();
      cy.deleteTable("Temp");
      cy.saveLocalStorage();
    });

    it("Create: 'After Insert' event", () => {
      createWebhook({
        title: "hook-1",
        event: "After Insert",
        type: "URL",
        url: {
          method: "POST",
          path: hookPath,
        },
      });
      clearServerData();
      addNewRow(1, "Poole");
      verifyHookTrigger(1, "Poole");
      updateRow(1, "Delaware");
      verifyHookTrigger(1, "Poole");
      deleteRow(1);
      verifyHookTrigger(1, "Poole");
    });

    it("Add 'After Update' event", () => {
      createWebhook({
        title: "hook-2",
        event: "After Update",
        type: "URL",
        url: {
          method: "POST",
          path: hookPath,
        },
      });
      clearServerData();
      addNewRow(1, "Poole");
      verifyHookTrigger(1, "Poole");
      updateRow(1, "Delaware");
      verifyHookTrigger(2, "Delaware");
      deleteRow(1);
      verifyHookTrigger(2, "Delaware");
    });

    it("Add 'After Delete' event", () => {
      createWebhook({
        title: "hook-3",
        event: "After Delete",
        type: "URL",
        url: {
          method: "POST",
          path: hookPath,
        },
      });
      clearServerData();
      addNewRow(1, "Poole");
      verifyHookTrigger(1, "Poole");
      updateRow(1, "Delaware");
      verifyHookTrigger(2, "Delaware");
      deleteRow(1);
      verifyHookTrigger(3, "Delaware");
    });

    it("Modify webhook", () => {
      openWebhook(0);
      configureWebhook({ event: "After Delete" });
      openWebhook(1);
      configureWebhook({ event: "After Delete" });

      clearServerData();
      addNewRow(1, "Poole");
      verifyHookTrigger(0, "");
      updateRow(1, "Delaware");
      verifyHookTrigger(0, "");
      deleteRow(1);
      verifyHookTrigger(3, "Delaware");
    });

    it("Delete webhook", () => {
      deleteWebhook(2);
      deleteWebhook(1);
      deleteWebhook(0);

      clearServerData();
      addNewRow(1, "Poole");
      verifyHookTrigger(0, "");
      updateRow(1, "Delaware");
      verifyHookTrigger(0, "");
      deleteRow(1);
      verifyHookTrigger(0, "");
    });

    it("Create, with condition", () => {
      // create 3 webhooks with all three events, with condition this time
      createWebhook({
        title: "hook-with-condition-1",
        event: "After Insert",
        type: "URL",
        url: {
          method: "POST",
          path: hookPath,
        },
        condition: {
          column: "Title",
          operator: "is like",
          value: "Poole",
        },
      });
      createWebhook({
        title: "hook-with-condition-2",
        event: "After Update",
        type: "URL",
        url: {
          method: "POST",
          path: hookPath,
        },
        condition: {
          column: "Title",
          operator: "is like",
          value: "Poole",
        },
      });
      createWebhook({
        title: "hook-with-condition-3",
        event: "After Delete",
        type: "URL",
        url: {
          method: "POST",
          path: hookPath,
        },
        condition: {
          column: "Title",
          operator: "is like",
          value: "Poole",
        },
      });

      clearServerData();
      addNewRow(1, "Poole");
      addNewRow(2, "Delaware");
      verifyHookTrigger(1, "Poole");
      updateRow(1, "Delaware");
      updateRow(2, "Poole");
      verifyHookTrigger(2, "Poole");
      deleteRow(2);
      deleteRow(1);
      verifyHookTrigger(3, "Poole");
    });

    it("Modify trigger condition", () => {
      openWebhook(0);
      configureWebhook({ deleteCondition: true });
      openWebhook(1);
      configureWebhook({ deleteCondition: true });
      openWebhook(2);
      configureWebhook({ deleteCondition: true });

      clearServerData();
      addNewRow(1, "Poole");
      addNewRow(2, "Delaware");
      verifyHookTrigger(2, "Delaware");
      updateRow(1, "Delaware");
      updateRow(2, "Poole");
      verifyHookTrigger(4, "Poole");
      deleteRow(2);
      deleteRow(1);
      verifyHookTrigger(6, "Delaware");
    });

    it("Delete trigger condition", () => {
      deleteWebhook(2);
      deleteWebhook(1);
      deleteWebhook(0);

      clearServerData();
      addNewRow(1, "Poole");
      verifyHookTrigger(0, "");
      updateRow(1, "Delaware");
      verifyHookTrigger(0, "");
      deleteRow(1);
      verifyHookTrigger(0, "");
    });
  });
};

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
