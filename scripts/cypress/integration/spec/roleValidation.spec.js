import { mainPage } from "../../support/page_objects/mainPage"
import { roles } from "../../support/page_objects/projectConstants"

// Left hand navigation bar, validation for
//  1. Audit menu
//  2. Advance settings menu
//  3. Preview mode menu
//
export function _advSettings(roleType, previewMode) {
    let validationString = (true == roles[roleType].validations.advSettings) ? 'exist' : 'not.exist'

    // audit/advance settings menu visible only for owner/ creator
    mainPage.navigationDraw(mainPage.AUDIT).should(validationString)
    mainPage.navigationDraw(mainPage.APPSTORE).should(validationString)
    mainPage.navigationDraw(mainPage.TEAM_N_AUTH).should(validationString)
    mainPage.navigationDraw(mainPage.PROJ_METADATA).should(validationString)

    // option to add new user conditionally visible only to owner/ creator
    cy.get('button:contains("New User")').should(validationString)    

    if (true == previewMode) {
        // preview mode, role toggle menubar is visible
        mainPage.navigationDraw(mainPage.ROLE_VIEW_EDITOR).should('exist')
        mainPage.navigationDraw(mainPage.ROLE_VIEW_COMMENTER).should('exist')
        mainPage.navigationDraw(mainPage.ROLE_VIEW_VIEWER).should('exist')
        mainPage.navigationDraw(mainPage.ROLE_VIEW_RESET).should('exist')
        
    } else {
        // normal mode, role toggle menubar is visible only for owner/ creator
        mainPage.navigationDraw(mainPage.ROLE_VIEW_EDITOR).should(validationString)
        mainPage.navigationDraw(mainPage.ROLE_VIEW_COMMENTER).should(validationString)
        mainPage.navigationDraw(mainPage.ROLE_VIEW_VIEWER).should(validationString)
    }
}


export function _editSchema(roleType, previewMode) {

    let columnName = 'City'
    let validationString = (true == roles[roleType].validations.editSchema) ? 'exist' : 'not.exist'
    
    if (false == previewMode) {
        cy.openTableTab(columnName)
    }
    // create table options
    //
    cy.get('.add-btn').should(validationString)
    cy.get('.v-tabs-bar').eq(0).find('button.mdi-plus-box').should(validationString)

    // delete table option
    //
    cy.get('.nc-table-delete-btn').should(validationString)

    // add new column option
    //        
    cy.get('.new-column-header').should(validationString)

    // update column (edit/ delete menu)
    //
    cy.get(`th:contains(${columnName}) .mdi-menu-down`).should(validationString)
}


export function _editData(roleType, previewMode) {

    let columnName = 'City'
    let validationString = (true == roles[roleType].validations.editData) ? 'exist' : 'not.exist'

    cy.openTableTab(columnName)

    // add new row option (from menu header)
    //
    cy.get('.nc-add-new-row-btn').should(validationString)

    // update row option (right click)
    //
    cy.get(`tbody > :nth-child(4) > [data-col="City"]`).rightclick()
    cy.get('.menuable__content__active').should(validationString)

    if (validationString == 'exist') {

        // right click options will exist (only for 'exist' case)
        //
        cy.getActiveMenu().contains('Insert New Row').should(validationString)
        cy.getActiveMenu().contains('Delete Row').should(validationString)
        cy.getActiveMenu().contains('Delete Selected Rows').should(validationString)
        cy.get('body').type('{esc}')

        // update cell contents option using row expander should be enabled
        //
        //cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
        cy.get('.v-input.row-checkbox').eq(4).next().next().click({ force: true })
        cy.getActiveModal().find('button').contains('Save Row').should('exist')
        cy.get('body').type('{esc}')

    }
    else {
        // update cell contents option using row expander should be disabled
        //
        //cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
        cy.get('.v-input.row-checkbox').eq(4).next().next().click({ force: true })
        cy.getActiveModal().find('button:disabled').contains('Save Row').should('exist')
        cy.getActiveModal().find('button').contains('Cancel').click()
        cy.get('body').type('{esc}')
    }

    // double click cell entries to edit
    //
    cy.get(`tbody > :nth-child(4) > [data-col="City"]`).dblclick().find('input').should(validationString)
}

// read &/ update comment
//      Viewer: only allowed to read
//      Everyone else: read &/ update
//
export function _editComment(roleType, previewMode) {

    let columnName = 'City'
    let validationString = (true == roles[roleType].validations.editComment) ? 'Comment added successfully' : 'Not allowed'

    cy.openTableTab(columnName)

    // click on comment icon & type comment
    //

    cy.get('.v-input.row-checkbox').eq(4).next().next().click({ force: true })
    //cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
    cy.getActiveModal().find('.mdi-comment-multiple-outline').should('exist').click()
    cy.getActiveModal().find('.comment-box').type('Comment-1{enter}')
    cy.getActiveModal().find('.mdi-door-open').click()

    // Expected response: 
    //      Viewer: Not allowed
    //      Everyone else: Comment added successfully
    //
    cy.get('body').contains(validationString, { timeout: 2000 }).should('exist')
    cy.wait(1000)
    cy.getActiveModal().find('button').contains('Cancel').click()
    cy.get('body').type('{esc}')
}

// right navigation menu bar
//      Editor/Viewer/Commenter : can only view 'existing' views
//      Rest: can create/edit
export function _viewMenu(roleType, previewMode) {

    let columnName = 'City'
    let navDrawListCnt = 2

    cy.openTableTab(columnName)
    let validationString = (true == roles[roleType].validations.shareView) ? 'exist' : 'not.exist'

    // validate if Share button is visible at header tool bar
    cy.get('header.v-toolbar').eq(0).find('button:contains("Share")').should(validationString)

    // Owner, Creator will have two navigation drawer (on each side of center panel)
    if (roleType == 'owner' || roleType == 'creator') {
        navDrawListCnt = 4
    }

    cy.get('.v-navigation-drawer__content').eq(1).find('[role="list"]').should('have.length', navDrawListCnt)

    // view list field (default GRID view)
    cy.get(`.nc-view-item`).should('exist')

    // view create option, exists only for owner/ creator
    cy.get(`.nc-create-gallery-view`).should(validationString)
    cy.get(`.nc-create-grid-view`).should(validationString)
    cy.get(`.nc-create-form-view`).should(validationString)

    // share view & automations, exists only for owner/creator
    cy.get(`.nc-share-view`).should(validationString)
    cy.get(`.nc-automations`).should(validationString)        
}
