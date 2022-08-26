import { mainPage, settingsPage } from "../../support/page_objects/mainPage";
import { roles } from "../../support/page_objects/projectConstants";

// Left hand navigation bar, validation for
//  1. Audit menu
//  2. Advance settings menu
//  3. Preview mode menu
//
export function _advSettings(roleType, mode) {
    cy.log(roleType, mode);

    if(mode === 'baseShare') {
        cy.get('.nc-project-menu').should('not.exist')
        return;
    }

    let validationString =
        true == roles[roleType].validations.advSettings ? "exist" : "not.exist";

    // cy.get(".nc-team-settings").should(validationString);
    cy.get('.nc-project-menu').should('exist').click()
    cy.getActiveMenu().find(`[data-menu-id="preview-as"]`).should(validationString)
    cy.getActiveMenu().find(`[data-menu-id="teamAndSettings"]:visible`).should(validationString)

    if (true === roles[roleType].validations.advSettings) {
        cy.getActiveMenu().find(`[data-menu-id="teamAndSettings"]:visible`).should(validationString).click()

        cy.get(`[data-menu-id="teamAndAuth"]`).should('exist')
        cy.get(`[data-menu-id="appStore"]`).should('exist')
        cy.get(`[data-menu-id="metaData"]`).should('exist')
        cy.get(`[data-menu-id="audit"]`).should('exist')

        settingsPage.closeMenu()
    } else {
        cy.get('.nc-project-menu').should('exist').click()
    }

    // float menu in preview mode
    if ("preview" === mode) {
        cy.get(".nc-floating-preview-btn").should("exist");
        cy.get('.nc-floating-preview-btn')
            .find(`[type="radio"][value="${roles[roleType].name}"]`)
            .should("be.checked");
    }

    // cy.get("body").click("bottomRight");
}

export function _editSchema(roleType, mode) {
    let columnName = "City";
    let validationString =
        true == roles[roleType].validations.editSchema ? "exist" : "not.exist";

    cy.openTableTab(columnName, 25);

    // create table
    cy.get(`.nc-add-import-btn`).should(validationString);

    // delete table option
    cy.get(`.nc-project-tree-tbl-City`).should("exist").rightclick();
    cy.get(".ant-dropdown-content:visible").should(validationString);

    if(validationString === "exist"){
        cy.getActiveMenu().find('[role="menuitem"]').contains("Delete").should("exist");
        cy.getActiveMenu().find('[role="menuitem"]').contains("Rename").should("exist");

        mainPage.getCell(columnName, 1).click();
    }

    // add new column option
    //
    cy.get(".nc-column-add").should(validationString);

    // update column (edit/ delete menu)
    cy.get('.nc-ui-dt-dropdown').should(validationString)
}

export function _editData(roleType, mode) {
    let columnName = "City";
    let validationString =
        true === roles[roleType].validations.editData ? "exist" : "not.exist";

    cy.openTableTab(columnName, 25);

    // add row
    cy.get('.nc-add-new-row-btn:visible').should(validationString);

    mainPage.getCell(columnName, 25).scrollIntoView();
    // cy.get('.nc-grid-add-new-cell').scrollIntoView();

    cy.get('.nc-grid-add-new-cell:visible').should(validationString);

    // update row option (right click)
    //
    mainPage.getCell("City", 5).rightclick();

    cy.wait(1000);

    cy.get(".ant-dropdown-content:visible").should(validationString);

    if (validationString === "exist") {
        // right click options will exist (only for 'exist' case)
        //
        cy.getActiveMenu().contains("Insert New Row").should(validationString);
        cy.getActiveMenu().contains("Clear cell").should(validationString);
        cy.getActiveMenu().contains("Delete Row").should(validationString);
        cy.getActiveMenu().contains("Delete Selected Rows").should(validationString);

        // cy.get("body").type("{esc}");
        mainPage.getCell("City", 13).click();

        // update cell contents option using row expander should be enabled
        //
        mainPage
          .getRow(1)
          .find('.nc-row-no').should('exist')
          .eq(0)
          .trigger('mouseover', { force: true })
        cy.get(".nc-row-expand")
          .should("exist")
          .eq(10)
          .click({ force: true });
        cy.getActiveDrawer().find("button").contains("Save row").should("exist");
        cy.getActiveDrawer().find("button").contains("Cancel").should("exist").click();
    } else {
        // update cell contents option using row expander should be disabled
        //
        cy.get(".nc-row-expand")
          .should("exist")
          .eq(10)
          .click({ force: true });
        cy.getActiveDrawer().find("button:disabled").contains("Save row").should("exist");
        cy.getActiveDrawer().find("button").contains("Cancel").should("exist").click();
    }

    // double click cell entries to edit
    //
    mainPage.getCell("City", 5)
        .dblclick()
        .find("input")
        .should(validationString);
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

    cy.wait(1000);

    // click on comment icon & type comment
    //
    cy.get(".nc-row-expand")
      .should("exist")
      .eq(10)
      .click({force:true});

    // Expected response:
    //      Viewer: Not able to see comment option
    //      Everyone else: Comment added/read successfully
    //

    cy.wait(3000);

    if ("viewer" === roleType) {
        cy.getActiveDrawer()
            .should('exist')
            .find(".nc-toggle-comments")
            .should("not.exist");
    } else {
        cy.getActiveDrawer()
            .should('exist')
            .find(".nc-toggle-comments")
            .should("exist")
            .click();

        cy.getActiveDrawer().find(".nc-comment-box").should('exist').type("Comment-1{enter}");
        cy.toastWait('Comment added successfully')
        cy.getActiveDrawer().find(".nc-toggle-comments").click();
    }

    cy.getActiveDrawer()
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

    // Download CSV, Excel
    let actionsMenuItemsCnt = 2;

    cy.openTableTab(columnName, 25);

    cy.wait(1000);

    // temporary!
    cy.get('.nc-toggle-right-navbar').click();
    cy.wait(1000);

    let validationString =
        true === roles[roleType].validations.shareView ? "exist" : "not.exist";

    if (roleType === "owner" || roleType === "creator") {
        // Download CSV / Download XLSX / Upload CSV / Shared View List / Webhook
        actionsMenuItemsCnt = 5;
    } else if (roleType == "editor") {
        // Download CSV / Upload CSV / Download XLSX
        actionsMenuItemsCnt = 2;
    }

    // view list field (default GRID view)
    cy.get(`.nc-view-item`).should("exist");

    // view create option, exists only for owner/ creator
    cy.get(`.nc-create-1-view`).should(validationString);
    cy.get(`.nc-create-2-view`).should(validationString);
    cy.get(`.nc-create-3-view`).should(validationString);

    // share view & automations, exists only for owner/creator
    // cy.get(".nc-btn-share-view").should(validationString);
    // cy.get(`.nc-webhook-btn`).should(validationString);

    // share view permissions are role specific

    // actions menu (more), only download csv should be visible for non-previlaged users
    cy.get(".nc-actions-menu-btn").click();
    cy.getActiveMenu()
        .find('.nc-project-menu-item')
        .should("have.length", actionsMenuItemsCnt);
}

export function _topRightMenu(roleType, mode) {
    // kludge; download csv menu persists until clicked
    let columnName = "City";
    cy.closeTableTab(columnName);
    cy.openTableTab(columnName, 25);

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

    cy.get(`.nc-project-tree-tbl-Language`).should(validationString)
    cy.get(`.nc-project-tree-tbl-CustomerList`).should(validationString)
}
