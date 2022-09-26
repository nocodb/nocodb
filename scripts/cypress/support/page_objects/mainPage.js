import { projectsPage } from "./navigation";

const path = require("path");

/**
 * Delete the downloads folder to make sure the test has "clean"
 * slate before starting.
 */
export const deleteDownloadsFolder = () => {
  const downloadsFolder = Cypress.config("downloadsFolder");
  cy.task("deleteFolder", downloadsFolder);
};

export class _settingsPage {
  constructor() {
    // menu
    this.TEAM_N_AUTH = "teamAndAuth";
    this.APPSTORE = "appStore";
    this.PROJ_METADATA = "projMetaData";
    this.AUDIT = "audit";

    // submenu
    this.USER_MANAGEMENT = "usersManagement";
    this.API_TOKEN_MANAGEMENT = "apiTokenManagement";
    this.APPS = "new";
    this.METADATA = "metaData";
    this.UI_ACCESS_CONTROL = "acl";
    this.AUDIT_LOG = "audit";
    this.ERD = "erd";
    this.MISC = "misc";
  }

  openMenu(menuId) {
    // open settings tab
    // cy.get('.nc-team-settings').should('exist').click()
    // cy.get(`[data-menu-id=${menuId}]`).should('exist').click()
    cy.get(".nc-project-menu").should("exist").click();
    cy.getActiveMenu(".nc-dropdown-project-menu")
      .find(`[data-menu-id="teamAndSettings"]`)
      .should("exist")
      .click();
    cy.get(`[data-menu-id=${menuId}]`).should("exist").click();
  }

  openTab(tabId) {
    cy.get(`[data-menu-id=${tabId}]`).should("exist").last().click();
  }

  closeMenu() {
    cy.getActiveModal().find(".nc-modal-close").click({ force: true });
  }

  openProjectMenu() {
    cy.get(".nc-project-menu").should("exist").click();
  }
}

// main page
export class _mainPage {
  constructor() {
    // Top Left items
    this.HOME = 0;

    this.AUDIT = 0;
    this.APPSTORE = 2;
    this.TEAM_N_AUTH = 3;
    this.PROJ_METADATA = 4;
    this.ROLE_VIEW = 5;
    this.ROLE_VIEW_EDITOR = 6;
    this.ROLE_VIEW_COMMENTER = 7;
    this.ROLE_VIEW_VIEWER = 8;
    this.ROLE_VIEW_RESET = 9;

    this.roleURL = {};
  }

  toolBarTopLeft(toolBarItem) {
    return cy
      .get("header.v-toolbar", { timeout: 20000 })
      .eq(0)
      .find("a")
      .eq(toolBarItem);
  }

  toolBarTopRight(toolBarItem) {
    return cy
      .get("header.v-toolbar", { timeout: 20000 })
      .eq(0)
      .find("button")
      .eq(toolBarItem);
  }

  navigationDraw(item) {
    // open settings tab
    cy.get(".nc-project-menu").should("exist").click();
    cy.getActiveMenu(".nc-dropdown-project-menu")
      .find(`[data-menu-id="teamAndSettings"]`)
      .should("exist")
      .click();

    switch (item) {
      case this.AUDIT:
        return cy.get(".nc-settings-audit:visible").should("exist");
      case this.APPSTORE:
        return cy.get(".nc-settings-appstore:visible").should("exist");
      case this.TEAM_N_AUTH:
        return cy.get(".nc-settings-teamauth:visible").should("exist");
      case this.PROJ_METADATA:
        return cy.get(".nc-settings-projmeta:visible").should("exist");
    }
  }

  // add new user to specified role
  //
  addNewUserToProject = (userCred, roleType) => {
    let linkText;
    let roleIndex = ["creator", "editor", "commenter", "viewer"].indexOf(
      roleType
    );

    // click on New User button, feed details
    cy.getActiveModal(".nc-modal-settings")
      .find("button.nc-invite-team")
      .click();

    // additional wait to ensure the modal is fully loaded
    cy.getActiveModal(".nc-modal-invite-user-and-share-base").should("exist");
    cy.getActiveModal(".nc-modal-invite-user-and-share-base")
      .find('input[placeholder="E-mail"]')
      .should("exist");

    cy.getActiveModal(".nc-modal-invite-user-and-share-base")
      .find('input[placeholder="E-mail"]')
      .type(userCred.username);
    cy.getActiveModal(".nc-modal-invite-user-and-share-base")
      .find(".ant-select.nc-user-roles")
      .click();

    // opt-in requested role & submit
    // cy.getActiveSelection().contains(roleType).click({force: true});
    cy.getActiveSelection(".nc-dropdown-user-role")
      .find(".nc-role-option")
      .eq(roleIndex)
      .should("exist")
      .click();
    cy.getActiveModal(".nc-modal-invite-user-and-share-base")
      .find("button.ant-btn-primary")
      .click();

    cy.toastWait("Successfully updated the user details");

    // get URL, invoke
    cy.getActiveModal(".nc-modal-invite-user-and-share-base")
      .find(".ant-alert-message")
      .then(($obj) => {
        linkText = $obj.text().trim();
        cy.log(linkText);
        this.roleURL[roleType] = linkText;

        cy.get("body").click("right");
      });
  };

  // addExistingUserToProject = (emailId, role) => {
  //     cy.get('.v-list-item:contains("Team & Auth")').click();
  //     cy.get(`tr:contains(${emailId})`)
  //         .find(".mdi-plus", { timeout: 2000 })
  //         .click();
  //     cy.get(`tr:contains(${emailId})`)
  //         .find(".mdi-pencil-outline", { timeout: 2000 })
  //         .click();
  //
  //     cy.get("label:contains(Select User Role)").click();
  //
  //     // opt-in requested role & submit
  //     //
  //     cy.getActiveMenu().contains(role).click();
  //     cy.get(".nc-invite-or-save-btn").click();
  //     cy.toastWait("Successfully updated the user details");
  //
  //     this.roleURL[role] =
  //         "http://localhost:3000/#/user/authentication/signin";
  // };

  getCell = (columnHeader, cellNumber) => {
    return cy
      .get(`:nth-child(${cellNumber}) > [data-title="${columnHeader}"]`)
      .last();
  };

  getPagination = (pageNumber) => {
    if (pageNumber == "<")
      return cy.get(".nc-pagination > .ant-pagination-prev");
    if (pageNumber == ">")
      return cy.get(".nc-pagination > .ant-pagination-next");

    return cy.get(
      `.nc-pagination > .ant-pagination-item.ant-pagination-item-${pageNumber}`
    );
  };

  getRow = (rowIndex) => {
    return cy.get(".xc-row-table").find("tr").eq(rowIndex);
  };

  addColumn = (colName, tableName) => {
    cy.get(".nc-column-add").click({
      force: true,
    });

    cy.getActiveMenu(".nc-dropdown-grid-add-column")
      .find("input.nc-column-name-input")
      .should("exist")
      .clear()
      .type(colName);
    cy.getActiveMenu(".nc-dropdown-grid-add-column")
      .find(".ant-btn-primary")
      .contains("Save")
      .should("exist")
      .click();
    cy.toastWait(`Column created`);
    cy.get(`th[data-title="${colName}"]`).should("exist");
  };

  addColumnWithType = (colName, colType, tableName) => {
    cy.get(".nc-column-add").click({
      force: true,
    });

    cy.getActiveMenu(".nc-dropdown-grid-add-column")
      .find("input.nc-column-name-input")
      .should("exist")
      .clear()
      .type(colName);

    // change column type and verify
    // cy.get(".nc-column-type-input").last().click();
    cy.getActiveMenu(".nc-dropdown-grid-add-column")
      .find(".nc-column-type-input")
      .last()
      .click();
    cy.getActiveSelection(".nc-dropdown-column-type")
      .find(".ant-select-item-option")
      .contains(colType)
      .click();
    // cy.get(".ant-btn-primary:visible").contains("Save").click();
    cy.getActiveMenu(".nc-dropdown-grid-add-column")
      .find(".ant-btn-primary:visible")
      .contains("Save")
      .click();

    cy.toastWait(`Column created`);
    cy.get(`th[data-title="${colName}"]`).should("exist");
  };

  deleteColumn = (colName) => {
    cy.get(`th:contains(${colName})`).should("exist");

    cy.get(`th:contains(${colName}) .nc-icon.ant-dropdown-trigger`)
      .trigger("mouseover", { force: true })
      .click({ force: true });

    // cy.get(".nc-column-delete").click();
    cy.getActiveMenu(".nc-dropdown-column-operations")
      .find(".nc-column-delete")
      .click();

    // cy.get(".nc-column-delete").should("not.be.visible");
    // cy.get(".ant-btn-dangerous:visible").contains("Delete").click();

    cy.getActiveModal(".nc-modal-column-delete")
      .find(".ant-btn-dangerous:visible")
      .contains("Delete")
      .click();

    cy.get(`th:contains(${colName})`).should("not.exist");
  };

  getAuthToken = () => {
    let obj = JSON.parse(localStorage["vuex"]);
    return obj["users"]["token"];
  };

  configureSMTP = (from, host, port, secure) => {
    cy.getActiveModal()
      .find(".nc-app-store-card-SMTP")
      .click()
      .then((obj) => {
        cy.wrap(obj).find(".nc-app-store-card-install").click({ force: true });
      });

    cy.getActiveModal()
      .find("#form_item_from")
      .should("exist")
      .clear()
      .type(from);
    cy.getActiveModal()
      .find("#form_item_host")
      .should("exist")
      .clear()
      .type(host);
    cy.getActiveModal()
      .find("#form_item_port")
      .should("exist")
      .clear()
      .type(port);
    // cy.getActiveModal().find('#form_item_secure').should('exist').clear().type(secure)
    cy.getActiveModal().find("button").contains("Save").click();

    cy.toastWait(
      "Successfully installed and email notification will use SMTP configuration"
    );
    settingsPage.closeMenu();
  };

  resetSMTP = () => {
    cy.getActiveModal()
      .find(".nc-app-store-card-SMTP")
      .click()
      .then((obj) => {
        cy.wrap(obj).find(".nc-app-store-card-reset").click({ force: true });
      });
    cy.getActiveModal().find("button").contains("Confirm").click();

    cy.toastWait("Plugin uninstalled successfully");
    settingsPage.closeMenu();
  };

  shareView = () => {
    return cy.get(".nc-btn-share-view").should("exist");
  };

  shareViewList = () => {
    cy.get(".nc-actions-menu-btn").should("exist").click();
    return cy
      .getActiveMenu(".nc-dropdown-actions-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Shared View List");
  };

  downloadCsv = () => {
    cy.get(".nc-actions-menu-btn").should("exist").click();
    return cy
      .getActiveMenu(".nc-dropdown-actions-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Download as CSV");
  };

  downloadExcel = () => {
    cy.get(".nc-actions-menu-btn").should("exist").click();
    return cy
      .getActiveMenu(".nc-dropdown-actions-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Download as XLSX");
  };

  uploadCsv = () => {
    cy.get(".nc-actions-menu-btn").should("exist").click();
    return cy
      .getActiveMenu(".nc-dropdown-actions-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Upload CSV");
  };

  automations = () => {
    cy.get(".nc-actions-menu-btn").should("exist").click();
    return cy
      .getActiveMenu(".nc-dropdown-actions-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Webhooks");
  };

  hideField = (field) => {
    cy.get(`th[data-title="${field}"]`).should("be.visible");
    cy.get(".nc-fields-menu-btn").click();
    cy.getActiveMenu(".nc-dropdown-fields-menu")
      .find(`.nc-fields-list label:contains(${field}):visible`)
      .click();
    cy.get(".nc-fields-menu-btn").click();
    cy.get(`th[data-title="${field}"]`).should("not.exist");
  };

  unhideField = (field) => {
    cy.get(`th[data-title="${field}"]`).should("not.exist");
    cy.get(".nc-fields-menu-btn").click();
    cy.getActiveMenu(".nc-dropdown-fields-menu")
      .find(`.nc-fields-list label:contains(${field}):visible`)
      .click();
    cy.get(".nc-fields-menu-btn").click();
    cy.get(`th[data-title="${field}"]`).should("be.visible");
  };

  sortField = (field, criteria) => {
    cy.get(".nc-sort-menu-btn").click();
    cy.getActiveMenu(".nc-dropdown-sort-menu")
      .find(".ant-btn-primary")
      .contains("Add Sort Option")
      .click();
    cy.getActiveMenu(".nc-dropdown-sort-menu:has(.nc-sort-field-select div)")
      .find(".nc-sort-field-select div")
      .first()
      .click();
    cy.getActiveSelection(".nc-dropdown-toolbar-field-list")
      .find(`.ant-select-item`)
      .contains(new RegExp("^" + field + "$", "g"))
      .should("exist")
      .click();
    cy.getActiveMenu(".nc-dropdown-sort-menu")
      .find(".nc-sort-dir-select div")
      .first()
      .click();
    cy.getActiveSelection(".nc-dropdown-sort-dir")
      .find(`.ant-select-item`)
      .contains(criteria)
      .should("exist")
      .click();
    cy.get(".nc-sort-menu-btn").click();
  };

  clearSort = () => {
    cy.get(".nc-sort-menu-btn").click();
    cy.getActiveMenu(".nc-dropdown-sort-menu")
      .find(".nc-sort-item-remove-btn")
      .click();
    cy.getActiveMenu(".nc-dropdown-sort-menu")
      .find(".nc-sort-item-remove-btn:visible")
      .should("not.exist");
    cy.get(".nc-sort-menu-btn").click();
  };

  filterField = (field, operation, value) => {
    cy.get(".nc-filter-menu-btn").click();
    cy.getActiveMenu(".nc-dropdown-filter-menu")
      .find(".ant-btn-primary")
      .contains("Add Filter")
      .click();

    cy.getActiveMenu(".nc-dropdown-filter-menu:has(.nc-filter-field-select)")
      .find(".nc-filter-field-select")
      .should("exist")
      .last()
      .click();
    cy.getActiveSelection(".nc-dropdown-toolbar-field-list")
      .find(`.ant-select-item`)
      .contains(new RegExp("^" + field + "$", "g"))
      .should("exist")
      .click();
    cy.getActiveMenu(".nc-dropdown-filter-menu")
      .find(".nc-filter-operation-select")
      .should("exist")
      .last()
      .click();
    cy.getActiveSelection(".nc-dropdown-filter-comp-op")
      .find(`.ant-select-item`)
      .contains(operation)
      .should("exist")
      .click();
    if (operation != "is null" && operation != "is not null") {
      cy.get(".nc-filter-value-select").should("exist").last().type(value);
    }
    cy.get(".nc-filter-menu-btn").click();
  };

  filterReset = () => {
    cy.get(".nc-filter-menu-btn").click();
    cy.getActiveMenu(".nc-dropdown-filter-menu")
      .find(".nc-filter-item-remove-btn")
      .click();
    cy.getActiveMenu(".nc-dropdown-filter-menu")
      .find(".nc-filter-item-remove-btn")
      .should("not.exist");
    cy.get(".nc-filter-menu-btn").click();
  };

  // delete created views
  //
  deleteCreatedViews = () => {
    this.shareViewList().click();

    cy.get('th:contains("View Link")')
      .should("be.visible")
      .parent()
      .parent()
      .next()
      .find("tr")
      .each(($tableRow) => {
        cy.log($tableRow[0].childElementCount);

        // one of the row would contain seggregation header ('other views)
        if (5 == $tableRow[0].childElementCount) {
          cy.wrap($tableRow).find(".nc-icon").last().click();
          cy.toastWait("Deleted shared view successfully");
        }
      })
      .then(() => {
        cy.getActiveModal()
          .find("button.ant-modal-close")
          .should("exist")
          .click();
      });
  };

  // download CSV & verify
  // download folder is configurable in cypress.
  //      trigger download
  //      wait for a while & check in configured download folder for the intended file
  //      if it exists, verify it against 'expectedRecords' passed in as parameter
  //
  downloadAndVerifyCsv = (filename, verifyCsv, role) => {
    if (role === "commenter" || role === "viewer") {
      cy.get(".nc-actions-menu-btn").click();
      cy.getActiveMenu(".nc-dropdown-actions-menu")
        .find(".nc-project-menu-item")
        .contains("Download as CSV")
        .click();
    } else {
      cy.get(".nc-actions-menu-btn").click();
      cy.getActiveMenu(".nc-dropdown-actions-menu")
        .find(".nc-project-menu-item")
        .contains("Download")
        .click();
      cy.get(".nc-project-menu-item:contains('Download as CSV')")
        .should("exist")
        .click();
    }

    cy.toastWait("Successfully exported all table data").then(() => {
      // download folder path, read from config file
      const downloadsFolder = Cypress.config("downloadsFolder");
      let filePath = path.join(downloadsFolder, filename);

      // append download folder path with filename to generate full file path, retrieve file
      cy.readFile(filePath).then((fileData) => {
        // from CSV, split into records (rows)
        const rows = fileData.replace(/\r\n/g, "\n").split("\n");
        verifyCsv(rows);
        deleteDownloadsFolder();
      });
    });
  };

  downloadAndVerifyCsvFromSharedView = (filename, verifyCsv) => {
    cy.get(".nc-actions-menu-btn").click();
    cy.get(".nc-project-menu-item")
      .contains("Download as CSV")
      .should("exist")
      .click();

    cy.toastWait("Successfully exported all table data").then(() => {
      // download folder path, read from config file
      const downloadsFolder = Cypress.config("downloadsFolder");
      let filePath = path.join(downloadsFolder, filename);

      // append download folder path with filename to generate full file path, retrieve file
      cy.readFile(filePath).then((fileData) => {
        // from CSV, split into records (rows)
        const rows = fileData.replace(/\r\n/g, "\n").split("\n");
        verifyCsv(rows);
        deleteDownloadsFolder();
      });
    });
  };

  getIFrameCell = (columnHeader, cellNumber) => {
    return cy
      .iframe()
      .find(`tbody > :nth-child(${cellNumber}) > [data-col="${columnHeader}"]`);
  };

  // https://docs.cypress.io/guides/core-concepts/variables-and-aliases#Sharing-Context
  getDatatype = (tableName, columnName) => {
    cy.window().then((win) => {
      const col = win.$nuxt.$store.state.meta.metas[tableName].columns;
      let dataType = "";
      col.forEach((element) => {
        if (element.cn == columnName) dataType = element.uidt;
      });
      cy.wrap(dataType).as("ncDatatype");
    });
  };

  openMetaTab() {
    // open Project metadata tab
    //
    settingsPage.openMenu(settingsPage.PROJ_METADATA);
    settingsPage.openTab(settingsPage.METADATA);
  }

  closeMetaTab() {
    // close Project metadata tab
    settingsPage.closeMenu();
  }

  metaSyncValidate(tbl, msg) {
    // http://localhost:8080/api/v1/db/meta/projects/p_bxp57hmks0n5o2/meta-diff
    cy.intercept("GET", "/api/v1/db/meta/projects/**").as("metaSync");

    cy.get(".nc-btn-metasync-reload").should("exist").click();
    cy.wait("@metaSync");

    cy.get(`.nc-metasync-row-${tbl}:contains(${msg})`).should("exist");
    cy.get(".nc-btn-metasync-sync-now")
      .should("exist")
      .click()
      .then(() => {
        cy.toastWait(`Table metadata recreated successfully`);
      });
    cy.get(".nc-metasync-row").then((row) => {
      for (let i = 0; i < row.length; i++) {
        cy.wrap(row).contains("No change identified").should("exist");
      }
    });
  }

  tabReset() {
    // temporary disable (kludge)
    // mainPage.toolBarTopLeft(mainPage.HOME).click({ force: true });
    // cy.get(".project-row").should("exist").click({ force: true });
    // projectsPage.waitHomePageLoad();
    // option-2
    // cy.openTableTab("Country", 0);
    // cy.get(".mdi-close").click({ multiple: true });
    // cy.get("button.ant-tabs-tab-remove").click({ multiple: true });
    // cy.get('.ant-tabs-tab-remove').should('not.exist')
  }

  toggleRightSidebar() {
    cy.get(".nc-toggle-right-navbar").should("exist").click();
  }

  openMiscTab() {
    // open Project metadata tab
    //
    settingsPage.openMenu(settingsPage.PROJ_METADATA);
    settingsPage.openTab(settingsPage.MISC);
  }

  toggleShowMMSetting() {
    // toggle show MM setting
    //
    this.openMiscTab();
    cy.get(".nc-settings-meta-misc").click();

    settingsPage.openTab(settingsPage.TEAM_N_AUTH);
    this.closeMetaTab();
  }

  openErdTab() {
    // open Project metadata tab
    //
    settingsPage.openMenu(settingsPage.PROJ_METADATA);
    settingsPage.openTab(settingsPage.ERD);
  }

  openTableErdView() {
    cy.get(".nc-actions-menu-btn").should("exist").click();
    cy.get(".nc-view-action-erd").should("exist").click();
  }
}

export const mainPage = new _mainPage();
export const settingsPage = new _settingsPage();

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
