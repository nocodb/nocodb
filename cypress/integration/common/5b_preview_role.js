
// pre-requisite: 
//      user@nocodb.com signed up as admin
//      sakilaDb database created already 

import { loginPage, projectsPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { roles } from "../../support/page_objects/projectConstants"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

// should we reverify permissions after preview reset?
const reVerificationAfterReset = false

// should we verify permissions in owner mode before preview?
const baseVerificationBeforePreview = false

const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    // project configuration settings
    //
    const advancedSettings = (roleType) => {

        cy.log(`##### advancedSettings: ${roleType}`)

        let validationString = (true == roles[roleType].validations.advSettings) ? 'exist' : 'not.exist'

        // restricted mode has only 3 lists & 3 items
        let vListLength = (true == roles[roleType].validations.advSettings) ? 4 : 3
        let vListItemLength = (true == roles[roleType].validations.advSettings) ? 6 : 3

        cy.get('.nc-nav-drawer').find('.v-list').should('has.length', vListLength)
        cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').should('has.length', vListItemLength)

        cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').contains('Audit').should('exist')
        cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').contains('App Store').should(validationString)
        cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').contains('Team & Auth').should(validationString)
        cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').contains('Project Metadata').should(validationString)

        // preview mode- common across all 
        cy.get('.nc-nav-drawer').find('.v-list').last().contains('editor').should('exist')
        cy.get('.nc-nav-drawer').find('.v-list').last().contains('commenter').should('exist')
        cy.get('.nc-nav-drawer').find('.v-list').last().contains('viewer').should('exist')

        // Reset preview option available only in 'preview mode'
        // Open team & auth after reset-preview to ensure 'New User' button is visible again
        //
        if (true == roles[roleType].validations.advSettings) {
            cy.get('.nc-nav-drawer').find('.v-list').last().contains('Reset Preview').should('not.exist')
            cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').contains('Team & Auth').click()
        }
        else {
            cy.get('.nc-nav-drawer').find('.v-list').last().contains('Reset Preview').should('exist')
        }

        cy.get('button:contains("New User")').should(validationString)
    }


    // Table data related validations
    //  - Add/delete/modify row
    //
    const editData = (roleType) => {

        cy.log(`##### editData: ${roleType}`)

        // TODO: to be fixed for roleType = 'editor'
        // Some of the expected buttons are invisible
        if (roleType == 'editor')
            return false

        // TODO: to be fixed for roleType = 'editor'
        // Unhandled exception
        if (roleType == 'viewer')
            return false

        let columnName = 'City'
        let validationString = (true == roles[roleType].validations.editData) ? 'exist' : 'not.exist'

        cy.openTableTab(columnName)

        // add new row option (from menu header)
        //
        cy.get('.nc-add-new-row-btn').should(validationString)

        // update row option (right click)
        //

        // TODO: roleType = viewer has an unhandled exception for rightClick
        if (roleType != 'viewer') {
            cy.get(`tbody > :nth-child(4) > [data-col="City"]`).rightclick()
            cy.get('.menuable__content__active').should(validationString)
        }

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


    // Schema related validations
    //  - Add/delete table
    //  - Add/Update/delete column
    //
    const editSchema = (roleType) => {

        cy.log(`##### editSchema: ${roleType}`)

        let columnName = 'City'
        let validationString = (true == roles[roleType].validations.editSchema) ? 'exist' : 'not.exist'

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


    // read &/ update comment
    //      Viewer: only allowed to read
    //      Everyone else: read &/ update
    //
    const editComment = (roleType) => {

        cy.log(`##### editComment: ${roleType}`)

        // TODO: to be fixed for roleType = 'editor'
        // Unhandled exception
        if (roleType == 'viewer')
            return false


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
    const viewMenu = (roleType) => {

        cy.log(`##### viewMenu: ${roleType}`)

        // TODO: to be fixed for roleType = 'editor'
        // Unhandled exception
        if (roleType == 'viewer')
            return false

        let columnName = 'City'
        let navDrawListCnt = 2
        let navDrawListItemCnt = 5
        cy.openTableTab(columnName)
        let validationString = (true == roles[roleType].validations.shareView) ? 'exist' : 'not.exist'

        // validate if Share button is visible at header tool bar
        cy.get('header.v-toolbar').eq(0).find('button:contains("Share")').should(validationString)

        // Owner, Creator will have two navigation drawer (on each side of center panel)
        if (validationString == 'exist') {
            navDrawListCnt = 4
            navDrawListItemCnt = 16
        }
        cy.get('.v-navigation-drawer__content').eq(1).find('[role="list"]').should('have.length', navDrawListCnt)
        cy.get('.v-navigation-drawer__content').eq(1).find('.v-list-item').should('have.length', navDrawListItemCnt)

        // redundant
        // cy.get('.v-navigation-drawer__content').eq(1).find('.v-list-item').eq(0).contains('Views').should('exist')
        // cy.get('.v-navigation-drawer__content').eq(1).find('.v-list-item').eq(1).contains('City').should('exist')

        // cy.get(`.nc-create-grid-view`).should(validationString)
        // cy.get(`.nc-create-gallery-view`).should(validationString)
    }


    ///////////////////////////////////////////////////////////
    //// Test Suite

    describe('Role preview validations', () => {

        // Sign in/ open project
        before(() => {
            loginPage.signIn(roles.owner.credentials)
            projectsPage.openProject('externalREST')
        })

        const genTestSub = (roleType) => {

            it(`Role type: ${roleType} > Advanced settings validation`, () => {

                if (true == baseVerificationBeforePreview)
                    advancedSettings('owner')

                // click on preview <role> & wait for page to switch over
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains(roleType).click()
                cy.wait(3000)

                advancedSettings(roleType)

                // reset preview to rollback to owner/creator mode
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains('Reset Preview').click()
                cy.wait(3000)

                if (reVerificationAfterReset == true)
                    advancedSettings('owner')

            })

            it(`Role type: ${roleType} >  Edit schema validation`, (done) => {
                // known issue: to be fixed
                // right click raising alarm 'not allowed' for viewer
                //
                cy.on('uncaught:exception', (err, runnable) => {
                    expect(err.message).to.include('Not allowed')
                    done()
                    return false
                })

                // open existing table-column
                //
                cy.openTableTab('City')

                if (true == baseVerificationBeforePreview)
                    editSchema('owner')

                // click on preview <role> & wait for page to switch over
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains(roleType).click()
                cy.wait(10000)

                editSchema(roleType)

                // reset preview to rollback to owner/creator mode
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains('Reset Preview').click()
                cy.wait(10000)

                if (reVerificationAfterReset == true)
                    editSchema('owner')

                cy.wait(100).then(() => {
                    done()
                })
            })

            it(`Role type: ${roleType} > Edit data validations`, () => {

                if (true == baseVerificationBeforePreview)
                    editData('owner')

                // click on preview <role> & wait for page to switch over
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains(roleType).click()
                cy.wait(3000)

                editData(roleType)

                // reset preview to rollback to owner/creator mode
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains('Reset Preview').click()
                cy.wait(3000)

                if (reVerificationAfterReset == true)
                    editData('owner')
            })


            it(`Role type: ${roleType} > Edit comment validations`, () => {

                if (true == baseVerificationBeforePreview)
                    editComment('owner')

                // click on preview <role> & wait for page to switch over
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains(roleType).click()
                cy.wait(3000)

                editComment(roleType)

                // reset preview to rollback to owner/creator mode
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains('Reset Preview').click()
                cy.wait(3000)

                if (reVerificationAfterReset == true)
                    editComment('owner')
            })

            it(`Role type: ${roleType} > View menu validations`, () => {

                if (true == baseVerificationBeforePreview)
                    viewMenu('owner')

                // click on preview <role> & wait for page to switch over
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains(roleType).click()
                cy.wait(3000)

                viewMenu(roleType)

                // reset preview to rollback to owner/creator mode
                mainPage.navigationDraw(mainPage.ROLE_VIEW).contains('Reset Preview').click()
                cy.wait(3000)

                if (reVerificationAfterReset == true)
                    viewMenu('owner')
            })
        }

        genTestSub('editor')
        genTestSub('commenter')

        // enable post xcAuditModeCommentsCount fix
        // genTestSub('viewer')
    })

}

genTest('rest', false)



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