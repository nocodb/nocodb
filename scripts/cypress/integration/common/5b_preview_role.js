// pre-requisite:
//      user@nocodb.com signed up as admin
//      sakilaDb database created already

import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage, settingsPage } from "../../support/page_objects/mainPage";
import {
  isPostgres,
  isTestSuiteActive,
  isXcdb,
  roles,
} from "../../support/page_objects/projectConstants";
import {
  _advSettings,
  _editSchema,
  _editData,
  _editComment,
  _viewMenu,
  _topRightMenu,
  enableTableAccess,
  _accessControl,
  disableTableAccess,
} from "../spec/roleValidation.spec";

export const genTest = (apiType, dbType, roleType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  ///////////////////////////////////////////////////////////
  //// Test Suite

  let clear;

  function configureAcl() {
    // open Project metadata tab
    //
    settingsPage.openMenu(settingsPage.PROJ_METADATA);
    settingsPage.openTab(settingsPage.UI_ACCESS_CONTROL);

    // validate if it has 19 entries representing tables & views
    if (isPostgres()) cy.get(".nc-acl-table-row").should("have.length", 24);
    else if (isXcdb()) cy.get(".nc-acl-table-row").should("have.length", 19);
    else cy.get(".nc-acl-table-row").should("have.length", 19);

    // disable table & view access
    //
    disableTableAccess("Language", "editor");
    disableTableAccess("Language", "commenter");
    disableTableAccess("Language", "viewer");

    disableTableAccess("CustomerList", "editor");
    disableTableAccess("CustomerList", "commenter");
    disableTableAccess("CustomerList", "viewer");

    cy.get("button.nc-acl-save").click();
    cy.toastWait("Updated UI ACL for tables successfully");

    mainPage.closeMetaTab();
  }

  describe("Role preview validations", () => {
    // Sign in/ open project
    before(() => {
      // cy.restoreLocalStorage();
      loginPage.loginAndOpenProject(apiType, dbType);

      clear = Cypress.LocalStorage.clear;
      Cypress.LocalStorage.clear = () => {};

      // configureAcl();

      cy.openTableTab("City", 25);

      settingsPage.openProjectMenu();
      cy.getActiveMenu(".nc-dropdown-project-menu")
        .find(`[data-submenu-id="preview-as"]`)
        .should("exist")
        .click();

      cy.get(".nc-role-preview-menu").should("have.length", 3);
      cy.get(`.nc-role-preview-menu:contains("Editor")`)
        .should("exist")
        .click();
    });

    after(() => {
      cy.get(".nc-preview-btn-exit-to-app").click();

      // wait for page rendering to complete
      cy.get(".nc-grid-row", { timeout: 25000 }).should("have.length", 25);

      cy.closeTableTab("City");

      // open Project metadata tab
      //
      settingsPage.openMenu(settingsPage.PROJ_METADATA);
      settingsPage.openTab(settingsPage.UI_ACCESS_CONTROL);

      // validate if it has 19 entries representing tables & views
      if (isPostgres()) cy.get(".nc-acl-table-row").should("have.length", 24);
      else if (isXcdb()) cy.get(".nc-acl-table-row").should("have.length", 19);
      else cy.get(".nc-acl-table-row").should("have.length", 19);

      // restore access
      //
      enableTableAccess("Language", "editor");
      enableTableAccess("Language", "commenter");
      enableTableAccess("Language", "viewer");

      enableTableAccess("Customerlist", "editor");
      enableTableAccess("Customerlist", "commenter");
      enableTableAccess("Customerlist", "viewer");
      cy.saveLocalStorage();
      Cypress.LocalStorage.clear = clear;
    });

    const genTestSub = (roleType) => {
      it(`Role preview: ${roleType}: Enable preview`, () => {
        cy.get(".nc-floating-preview-btn", { timeout: 30000 }).should("exist");
        cy.get(".nc-floating-preview-btn")
          .find(`[type="radio"][value="${roleType}"]`)
          .should("exist")
          .click();
      });

      it(`Role preview: ${roleType}: Advance settings`, () => {
        // project configuration settings
        //
        _advSettings(roleType, "preview");
      });

      it(`Role preview: ${roleType}: Access control`, () => {
        // Access control validation
        //
        _accessControl(roleType, "preview");
      });

      it(`Role preview: ${roleType}: Edit data`, () => {
        // Table data related validations
        //  - Add/delete/modify row
        //
        _editData(roleType, "preview");
      });

      it(`Role preview: ${roleType}: Edit comment`, () => {
        // read &/ update comment
        //      Viewer: not allowed to read
        //      Everyone else: read &/ update
        //
        _editComment(roleType, "preview");
      });

      it(`Role preview: ${roleType}: Preview menu`, () => {
        // right navigation menu bar
        //      Editor/Viewer/Commenter : can only view 'existing' views
        //      Rest: can create/edit
        _viewMenu(roleType, "preview");
      });

      it(`Role preview: ${roleType}: Edit Schema`, () => {
        // Schema related validations
        //  - Add/delete table
        //  - Add/Update/delete column
        //
        _editSchema(roleType, "preview");
      });
    };

    genTestSub("editor");
    genTestSub("commenter");
    genTestSub("viewer");
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
