import { mainPage } from "../../support/page_objects/mainPage";
import { roles } from "../../support/page_objects/projectConstants";

// Left hand navigation bar, validation for
//  1. Audit menu
//  2. Advance settings menu
//  3. Preview mode menu
//
export function _advSettings(roleType, previewMode) {
    cy.log(roleType, previewMode);

    let validationString =
        true == roles[roleType].validations.advSettings ? "exist" : "not.exist";

    cy.get(".nc-team-settings").should(validationString);

    if (true === roles[roleType].validations.advSettings) {
        // audit/advance settings menu visible only for owner/ creator
        mainPage.navigationDraw(mainPage.AUDIT).should(validationString);
        mainPage.closeMetaTab();
        mainPage.navigationDraw(mainPage.APPSTORE).should(validationString);
        mainPage.closeMetaTab();
        mainPage.navigationDraw(mainPage.TEAM_N_AUTH).should(validationString);
        mainPage.closeMetaTab();
        mainPage
            .navigationDraw(mainPage.PROJ_METADATA)
            .should(validationString);
        mainPage.closeMetaTab();
    }

    // option to add new user conditionally visible only to owner/ creator
    cy.get('button:contains("New User")').should(validationString);

    // preview button visibility
    cy.get(".nc-btn-preview:visible").should(validationString);

    // float menu in preview mode
    if (true === previewMode) {
        cy.get(".nc-floating-preview-btn").should("exist");
        cy.getActiveMenu()
            .find(`[type="radio"][value="${roles[roleType].name}"]`)
            .should("be.checked");
    }

    // if (true == previewMode) {
    //     // preview mode, role toggle menubar is visible
    //     mainPage.navigationDraw(mainPage.ROLE_VIEW_EDITOR).should("exist");
    //     mainPage.navigationDraw(mainPage.ROLE_VIEW_COMMENTER).should("exist");
    //     mainPage.navigationDraw(mainPage.ROLE_VIEW_VIEWER).should("exist");
    //     mainPage.navigationDraw(mainPage.ROLE_VIEW_RESET).should("exist");
    // } else {
    //     // normal mode, role toggle menubar is visible only for owner/ creator
    //     mainPage
    //         .navigationDraw(mainPage.ROLE_VIEW_EDITOR)
    //         .should(validationString);
    //     mainPage
    //         .navigationDraw(mainPage.ROLE_VIEW_COMMENTER)
    //         .should(validationString);
    //     mainPage
    //         .navigationDraw(mainPage.ROLE_VIEW_VIEWER)
    //         .should(validationString);
    // }

    cy.get("body").click("bottomRight");
}

export function _editSchema(roleType, previewMode) {
    let columnName = "City";
    let validationString =
        true == roles[roleType].validations.editSchema ? "exist" : "not.exist";

    if (false == previewMode) {
        cy.openTableTab(columnName, 25);
    }

    // create table options
    //
    cy.get(".add-btn").should(validationString);
    cy.get(".v-tabs-bar")
        .eq(0)
        .find("button.mdi-plus-box")
        .should(validationString);

    // delete table option
    //
    cy.get(".nc-table-delete-btn").should(validationString);

    // add new column option
    //
    cy.get(".new-column-header").should(validationString);

    // update column (edit/ delete menu)
    //
    cy.get(`th:contains(${columnName}) .mdi-menu-down`).should(
        validationString
    );
}

export function _editData(roleType, previewMode) {
    let columnName = "City";
    let validationString =
        true == roles[roleType].validations.editData ? "exist" : "not.exist";

    cy.openTableTab(columnName, 25);

    // add new row option (from menu header)
    //
    cy.get(".nc-add-new-row-btn").should(validationString);

    // update row option (right click)
    //
    cy.get(`tbody > :nth-child(4) > [data-col="City"]`).rightclick();

    if (previewMode)
        cy.getActiveMenu().contains("Insert New Row").should(validationString);
    else cy.get(".menuable__content__active").should(validationString);

    if (validationString == "exist") {
        // right click options will exist (only for 'exist' case)
        //
        cy.getActiveMenu().contains("Insert New Row").should(validationString);
        cy.getActiveMenu().contains("Delete Row").should(validationString);
        cy.getActiveMenu()
            .contains("Delete Selected Rows")
            .should(validationString);
        cy.get("body").type("{esc}");

        // update cell contents option using row expander should be enabled
        //
        //cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
        cy.get(".v-input.row-checkbox")
            .eq(4)
            .next()
            .next()
            .click({ force: true });
        cy.getActiveModal().find("button").contains("Save row").should("exist");
        cy.get("body").type("{esc}");
    } else {
        // update cell contents option using row expander should be disabled
        //
        //cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
        cy.get(".v-input.row-checkbox")
            .eq(4)
            .next()
            .next()
            .click({ force: true });
        cy.getActiveModal()
            .find("button:disabled")
            .contains("Save row")
            .should("exist");
        cy.getActiveModal().find("button").contains("Cancel").click();
        cy.get("body").type("{esc}");
    }

    // double click cell entries to edit
    //
    cy.get(`tbody > :nth-child(4) > [data-col="City"]`)
        .dblclick()
        .find("input")
        .should(validationString);
}

// read &/ update comment
//      Viewer: only allowed to read
//      Everyone else: read &/ update
//
export function _editComment(roleType, previewMode) {
    let columnName = "City";
    let validationString =
        true == roles[roleType].validations.editComment
            ? "Comment added successfully"
            : "Not allowed";

    cy.openTableTab(columnName, 25);

    // click on comment icon & type comment
    //

    cy.get(".v-input.row-checkbox").eq(4).next().next().click({ force: true });

    // Expected response:
    //      Viewer: Not able to see comment option
    //      Everyone else: Comment added/read successfully
    //

    if ("viewer" == roleType) {
        cy.getActiveModal()
            .find(".mdi-comment-multiple-outline")
            .should("not.exist");
    } else {
        cy.getActiveModal()
            .find(".mdi-comment-multiple-outline")
            .should("exist")
            .click();
        cy.getActiveModal().find(".comment-box").type("Comment-1{enter}");
        // cy.toastWait('Comment added successfully')
        cy.getActiveModal().find(".mdi-door-open").click();

        cy.get("body")
            .contains(validationString, { timeout: 2000 })
            .should("exist");
    }

    cy.getActiveModal()
        .find("button")
        .contains("Cancel")
        .should("exist")
        .click();
    cy.get("body").type("{esc}");
}

// right navigation menu bar
//      Editor/Viewer/Commenter : can only view 'existing' views
//      Rest: can create/edit
export function _viewMenu(roleType, previewMode) {
    let columnName = "City";
    let navDrawListCnt = 1;
    let actionsMenuItemsCnt = 1;

    cy.openTableTab(columnName, 25);

    let validationString =
        true == roles[roleType].validations.shareView ? "exist" : "not.exist";

    // validate if Share button is visible at header tool bar
    cy.get("header.v-toolbar")
        .eq(0)
        .find('button:contains("Share")')
        .should(validationString);

    // Owner, Creator will have two navigation drawer (on each side of center panel)
    if (roleType == "owner" || roleType == "creator") {
        navDrawListCnt = 2;
        actionsMenuItemsCnt = 4;
    }

    cy.get(".v-navigation-drawer__content")
        .eq(1)
        .find('[role="list"]')
        .should("have.length", navDrawListCnt);

    // view list field (default GRID view)
    cy.get(`.nc-view-item`).should("exist");

    // view create option, exists only for owner/ creator
    cy.get(`.nc-create-gallery-view`).should(validationString);
    cy.get(`.nc-create-grid-view`).should(validationString);
    cy.get(`.nc-create-form-view`).should(validationString);

    // share view & automations, exists only for owner/creator
    // cy.get(`.nc-share-view`).should(validationString);
    // cy.get(`.nc-automations`).should(validationString);
    // mainPage.shareView().should(validationString);
    // mainPage.automations().should(validationString);

    // share view permissions are role specific
    cy.get(".nc-btn-share-view").should(validationString);

    // actions menu (more), only download csv should be visible for non-previlaged users
    cy.get(".nc-actions-menu-btn").click();
    cy.getActiveMenu()
        .find('[role="menuitem"]')
        .should("have.length", actionsMenuItemsCnt);
}

export function _topRightMenu(roleType, previewMode) {
    // kludge; download csv menu persists until clicked
    let columnName = "City";
    cy.closeTableTab(columnName);
    cy.openTableTab(columnName, 25);

    let validationString =
        true == roles[roleType].validations.shareView ? "exist" : "not.exist";
    cy.get(".nc-topright-menu").find(".nc-menu-share").should(validationString);

    // cy.get(".nc-topright-menu").find(".nc-menu-theme").should("exist");
    // cy.get(".nc-topright-menu").find(".nc-menu-dark-theme").should("exist");
    cy.get(".nc-topright-menu").find(".nc-menu-translate").should("exist");
    cy.get(".nc-topright-menu").find(".nc-menu-account").should("exist");
    // cy.get(".nc-topright-menu").find(".nc-menu-alert").should("exist");
}

// Access control list
//
export function disableTableAccess(tbl, role) {
    const cls = `.nc-acl-${tbl}-${role}-chkbox`;
    cy.get(cls).find("input").should("be.checked").click({ force: true });
    cy.get(cls).find("input").should("not.be.checked");
    cy.get(".nc-acl-save").next().click({ force: true });
    cy.toastWait("Updated UI ACL for tables successfully");
}

export function enableTableAccess(tbl, role) {
    const cls = `.nc-acl-${tbl}-${role}-chkbox`;
    cy.get(cls).find("input").should("not.be.checked").click({ force: true });
    cy.get(cls).find("input").should("be.checked");
    cy.get(".nc-acl-save").next().click({ force: true });
    cy.toastWait("Updated UI ACL for tables successfully");
}

export function _accessControl(roleType, previewMode) {
    let validationString = roleType == "creator" ? "exist" : "not.exist";
    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .should("exist")
        .first()
        .click({ force: true });

    cy.get(".nc-project-tree")
        .contains("Language", { timeout: 6000 })
        .should(validationString);

    cy.get(".nc-project-tree")
        .contains("CustomerList", { timeout: 6000 })
        .should(validationString);

    cy.get(".nc-project-tree")
        .find(".v-list-item__title:contains(Tables)", { timeout: 10000 })
        .first()
        .click({ force: true });
}
