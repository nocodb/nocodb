import { mainPage, settingsPage } from "../../support/page_objects/mainPage";
import { roles } from "../../support/page_objects/projectConstants";

// Left hand navigation bar, validation for
//  1. Audit menu
//  2. Advance settings menu
//  3. Preview mode menu
//
export function _advSettings(roleType, mode) {
  cy.log(roleType, mode);

  if (mode === "baseShare") {
    // open modal
    cy.get(".nc-project-menu").should("exist").click();
    cy.getActiveMenu(".nc-dropdown-project-menu")
      .find(`[data-menu-id="language"]`)
      .should("exist");

    // click again to close modal
    cy.get(".nc-project-menu").should("exist").click();
    return;
  }

  let validationString =
    true == roles[roleType].validations.advSettings ? "exist" : "not.exist";

  // cy.get(".nc-team-settings").should(validationString);
  cy.get(".nc-project-menu").should("exist").click();
  cy.getActiveMenu(".nc-dropdown-project-menu")
    .find(`[data-menu-id="preview-as"]`)
    .should(validationString);
  cy.getActiveMenu(".nc-dropdown-project-menu")
    .find(`[data-menu-id="teamAndSettings"]:visible`)
    .should(validationString);

  if (true === roles[roleType].validations.advSettings) {
    cy.getActiveMenu(".nc-dropdown-project-menu")
      .find(`[data-menu-id="teamAndSettings"]:visible`)
      .should(validationString)
      .click();

    cy.get(`[data-menu-id="teamAndAuth"]`).should("exist");
    if (roleType === "owner")
      cy.get(`[data-menu-id="appStore"]`).should("exist");
    cy.get(`[data-menu-id="projMetaData"]`).should("exist");
    cy.get(`[data-menu-id="audit"]`).should("exist");

    settingsPage.closeMenu();
  } else {
    cy.get(".nc-project-menu").should("exist").click();
  }

  // float menu in preview mode
  if ("preview" === mode) {
    cy.get(".nc-floating-preview-btn").should("exist");
    cy.get(".nc-floating-preview-btn")
      .find(`[type="radio"][value="${roles[roleType].name}"]`)
      .should("be.checked");
  }

  // cy.get("body").click("bottomRight");
}

export function _editSchema(roleType, mode) {
  let columnName = "City";
  let validationString =
    true === roles[roleType].validations.editSchema ? "exist" : "not.exist";

  cy.openTableTab(columnName, 25);

  // create table
  cy.get(`.nc-add-new-table`).should(validationString);

  // delete table option
  cy.get(`.nc-project-tree-tbl-City`).should("exist").rightclick();
  cy.get(".ant-dropdown-content:visible").should(validationString);

  if (validationString === "exist") {
    cy.getActiveMenu(".nc-dropdown-tree-view-context-menu")
      .find('[role="menuitem"]')
      .contains("Delete")
      .should("exist");
    cy.getActiveMenu(".nc-dropdown-tree-view-context-menu")
      .find('[role="menuitem"]')
      .contains("Rename")
      .should("exist");

    // click on a cell to close table context menu
    mainPage.getCell(columnName, 3).click();
  }

  // add new column option
  //
  cy.get(".nc-column-add").should(validationString);

  // update column (edit/ delete menu)
  cy.get(".nc-ui-dt-dropdown").should(validationString);

  if (validationString === "exist") {
    cy.get(".nc-import-menu").should("exist").click();
    cy.getActiveMenu(".nc-dropdown-import-menu").should("exist");
    cy.getActiveMenu(".nc-dropdown-import-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Airtable");
    cy.getActiveMenu(".nc-dropdown-import-menu")
      .find(".ant-dropdown-menu-item")
      .contains("CSV file");
    cy.getActiveMenu(".nc-dropdown-import-menu")
      .find(".ant-dropdown-menu-item")
      .contains("JSON file");
    cy.getActiveMenu(".nc-dropdown-import-menu")
      .find(".ant-dropdown-menu-item")
      .contains("Microsoft Excel");
  }
}

export function _editData(roleType, mode) {
  let columnName = "City";
  let validationString =
    true === roles[roleType].validations.editData ? "exist" : "not.exist";

  cy.openTableTab(columnName, 25);

  // add row button
  cy.get(".nc-add-new-row-btn:visible").should(validationString);

  // add button at bottom of page
  mainPage.getCell(columnName, 25).scrollIntoView();
  cy.get(".nc-grid-add-new-cell:visible").should(validationString);

  // update row option (right click)
  //
  mainPage.getCell("City", 5).rightclick();
  cy.wait(100);
  cy.get(".ant-dropdown-content:visible").should(validationString);

  if (validationString === "exist") {
    // right click options will exist (only for 'exist' case)
    //
    cy.getActiveMenu(".nc-dropdown-grid-context-menu")
      .contains("Insert New Row")
      .should(validationString);
    cy.getActiveMenu(".nc-dropdown-grid-context-menu")
      .contains("Clear cell")
      .should(validationString);
    cy.getActiveMenu(".nc-dropdown-grid-context-menu")
      .contains("Delete Row")
      .should(validationString);
    cy.getActiveMenu(".nc-dropdown-grid-context-menu")
      .contains("Delete Selected Rows")
      .should(validationString);

    // cy.get("body").type("{esc}");
    mainPage.getCell("City", 13).click();

    // update cell contents option using row expander should be enabled
    //
    mainPage
      .getRow(1)
      .find(".nc-row-no")
      .should("exist")
      .eq(0)
      .trigger("mouseover", { force: true });
    cy.get(".nc-row-expand").should("exist").eq(10).click({ force: true });

    // wait for page render to complete
    cy.get('button:contains("Save row"):visible').should("exist");

    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find("button")
      .contains("Save row")
      .should("exist");
    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find("button")
      .contains("Cancel")
      .should("exist")
      .click();
  } else {
    // update cell contents option using row expander should be disabled
    //
    cy.get(".nc-row-expand").should("exist").eq(10).click({ force: true });

    // wait for page render to complete
    cy.get('button:contains("Save row"):visible').should("exist");

    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find("button:disabled")
      .contains("Save row")
      .should("exist");
    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find("button")
      .contains("Cancel")
      .should("exist")
      .click();
  }

  // double click cell entries to edit
  //
  mainPage.getCell("City", 5).dblclick().find("input").should(validationString);
}

// read &/ update comment
//      Viewer: only allowed to read
//      Everyone else: read &/ update
//
export function _editComment(roleType, mode) {
  let columnName = "City";
  let validationString =
    true === roles[roleType].validations.editComment
      ? "Comment added successfully"
      : "Not allowed";

  cy.openTableTab(columnName, 25);

  // click on comment icon & type comment
  //
  cy.get(".nc-row-expand").should("exist").eq(10).click({ force: true });

  // Expected response:
  //      Viewer: Not able to see comment option
  //      Everyone else: Comment added/read successfully
  //

  if ("viewer" === roleType) {
    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .should("exist")
      .find(".nc-toggle-comments")
      .should("not.exist");
  } else {
    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .should("exist")
      .find(".nc-toggle-comments")
      .should("exist")
      .click();

    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find(".nc-comment-box")
      .should("exist")
      .type("Comment-1{enter}");
    // cy.toastWait('Comment added successfully')
    cy.getActiveDrawer(".nc-drawer-expanded-form")
      .find(".nc-toggle-comments")
      .click();
  }

  cy.getActiveDrawer(".nc-drawer-expanded-form")
    .find("button")
    .contains("Cancel")
    .should("exist")
    .click();
}

// right navigation menu bar
//      Editor/Viewer/Commenter : can only view 'existing' views
//      Rest: can create/edit
export function _viewMenu(roleType, mode) {
  let columnName = "City";

  // Lock, Download, Upload
  let menuWithSubmenuCount = 3;

  // share view list, webhook, api snippet, erd
  let menuWithoutSubmenuCount = 4;

  cy.openTableTab(columnName, 25);

  let validationString =
    true === roles[roleType].validations.shareView ? "exist" : "not.exist";

  if (roleType === "editor") {
    // Download / Upload CSV
    menuWithSubmenuCount = 2;
    // Get API Snippet and ERD
    menuWithoutSubmenuCount = 2;
    // ERD
    if (mode === "baseShare") menuWithoutSubmenuCount = 1;
  } else if (roleType === "commenter" || roleType === "viewer") {
    // Download CSV & Download excel
    menuWithSubmenuCount = 0;
    // Get API Snippet and ERD
    menuWithoutSubmenuCount = 2;
  }

  // view list field (default GRID view)
  cy.get(`.nc-view-item`).should("exist");

  // view create option, exists only for owner/ creator
  cy.get(`.nc-create-grid-view`).should(validationString);
  cy.get(`.nc-create-gallery-view`).should(validationString);
  cy.get(`.nc-create-form-view`).should(validationString);

  // share view permissions are role specific

  // actions menu (more), only download csv should be visible for non-previlaged users
  cy.get(".nc-actions-menu-btn").click();
  cy.getActiveMenu(".nc-dropdown-actions-menu")
    .find(".ant-dropdown-menu-submenu:visible")
    .should("have.length", menuWithSubmenuCount);
  cy.getActiveMenu(".nc-dropdown-actions-menu")
    .find(".ant-dropdown-menu-item:visible")
    .should("have.length", menuWithoutSubmenuCount);
  // click again to close menu
  cy.get(".nc-actions-menu-btn").click();
}

export function _topRightMenu(roleType, mode) {
  // kludge; download csv menu persists until clicked
  let columnName = "City";
  // cy.closeTableTab(columnName);
  // cy.openTableTab(columnName, 25);

  let validationString =
    true == roles[roleType].validations.shareView ? "exist" : "not.exist";

  cy.get(`.nc-share-base`).should(validationString);
  cy.get(".nc-menu-translate").should("exist");
  cy.get(".nc-menu-accounts").should("exist");
}

// Access control list
//
export function disableTableAccess(tbl, role) {
  const cls = `.nc-acl-${tbl}-${role}-chkbox`;
  cy.get(cls).find("input").should("be.checked").click({ force: true });
  cy.get(cls).find("input").should("not.be.checked");
}

export function enableTableAccess(tbl, role) {
  const cls = `.nc-acl-${tbl}-${role}-chkbox`;
  cy.get(cls).find("input").should("not.be.checked").click({ force: true });
  cy.get(cls).find("input").should("be.checked");
}

export function _accessControl(roleType, previewMode) {
  let validationString = roleType === "creator" ? "exist" : "not.exist";

  cy.get(`.nc-project-tree-tbl-Language`).should(validationString);
  cy.get(`.nc-project-tree-tbl-CustomerList`).should(validationString);
}
