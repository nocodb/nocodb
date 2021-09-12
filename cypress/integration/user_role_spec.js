import { loginPage, projectsPage } from "../support/page_objects/navigation"

const roleOwner = 0
const roleCreator = 1
const roleEditor = 2
const roleCommenter = 3
const roleViewer = 4

const roleString = ['owner', 'creator', 'editor', 'commenter', 'viewer']

// to store URL links for new user (role based) Sign Up
let linkText = []

const userCredentials = [
    { username: 'user@nocodb.com', password: 'Password123.' },
    { username: 'creator@nocodb.com', password: 'Password123.' },
    { username: 'editor@nocodb.com', password: 'Password123.' },
    { username: 'commenter@nocodb.com', password: 'Password123.' },
    { username: 'viewer@nocodb.com', password: 'Password123.' }]

// add new user to specified role
//
const addUser = (userCred, role) => {

    // click on New User button, feed details
    cy.get('button:contains("New User")').first().click()
    cy.get('label:contains(Email)').next('input').type(userCred.username).trigger('input')
    cy.get('label:contains(Select User roles)').click()

    // opt-in requested role & submit
    // note that, 'editor' is set by default
    //
    cy.getActiveMenu().contains(role).click()
    cy.getActiveMenu().contains('editor').click()
    cy.get('.mdi-menu-down').click()
    cy.get('.nc-invite-or-save-btn').click()

    // get URL, invoke
    cy.getActiveModal().find('.v-alert').then(($obj) => {
        linkText[role] = $obj.text()
        cy.log(linkText[role])

        cy.visit(linkText[role])
    })

    // SignUp is taken care under userRoleCreation()
    // wait for some time to ensure screen is loaded
    //
    cy.wait(2000)
}


const userRoleCreation = (role) => {
    it(`User creation: ${roleString[role]}`, () => {

        loginPage.signIn(userCredentials[roleOwner])
        projectsPage.openProject('sakilaDb')

        // Team & Auth tab is open by default
        //
        addUser(userCredentials[role], roleString[role])

        // Redirected to new URL, feed details
        //
        cy.get('input[type="text"]').type(userCredentials[role].username)
        cy.get('input[type="password"]').type(userCredentials[role].password)
        cy.get('button:contains("SIGN UP")').click()

        cy.url({ timeout: 6000 }).should('contain', '#/project')
        cy.wait(1000)

        projectsPage.openProject('sakilaDb')
    })
}

describe(`User role validation`, () => {

    let projectName = ''

    // Create project & create different user-roles
    //
    it('Create Project', () => {

        loginPage.signUp(userCredentials[roleOwner])

        const projectParams = { dbType: 1, apiType: 0, name: 'sakilaDb' }
        const databaseParams = {
            databaseType: 0,
            hostAddress: 'localhost',
            portNumber: '3306',
            username: 'root',
            password: 'password',
            databaseName: 'sakila'
        }

        projectName = projectsPage.createProject(projectParams, databaseParams)

        userRoleCreation(roleCreator)
        userRoleCreation(roleEditor)
        userRoleCreation(roleCommenter)
        userRoleCreation(roleViewer)

    })

    // Schema related validations
    //  - Add/delete table
    //  - Add/Update/delete column
    //
    const editSchema = (validationString) => {

        let columnName = 'City'

        // create table options
        //
        cy.get('.add-btn').should(validationString)
        cy.get('.v-tabs-bar').eq(0).find('button.mdi-plus-box').should(validationString)

        // open existing table-column
        //
        cy.openTableTab(columnName)

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

    // Table data related validations
    //  - Add/delete/modify row
    //
    const editData = (validationString) => {

        let columnName = 'City'

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
            cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
            cy.getActiveModal().find('button').contains('Save Row').should('exist')
            cy.get('body').type('{esc}')

        }
        else {
            // update cell contents option using row expander should be disabled
            //
            cy.get('.nc-row-expand-icon').eq(4).click({ force: true })
            cy.getActiveModal().find('button:disabled').contains('Save Row').should('exist')
            cy.get('body').type('{esc}')
        }

        // double click cell entries to edit
        //
        cy.get(`tbody > :nth-child(4) > [data-col="City"]`).dblclick().find('input').should(validationString)
    }

    it('Validation: Owner', () => {
        loginPage.signIn(userCredentials[roleOwner])
        projectsPage.openProject('sakilaDb')

        editSchema('exist')
        editData('exist')
    })

    it('Validation: Creator', () => {
        loginPage.signIn(userCredentials[roleCreator])
        projectsPage.openProject('sakilaDb')

        editSchema('exist')
        editData('exist')
    })

    it.only('Validation: editor', () => {
        loginPage.signIn(userCredentials[roleEditor])
        projectsPage.openProject('sakilaDb')

        editSchema('not.exist')
        editData('exist')
    })

    it('Validation: commenter', () => {
        loginPage.signIn(userCredentials[roleCommenter])
        projectsPage.openProject('sakilaDb')

        editSchema('not.exist')
        editData('not.exist')
    })

    it('Validation: Viewer', () => {
        loginPage.signIn(userCredentials[roleViewer])
        projectsPage.openProject('sakilaDb')

        editSchema('not.exist')
        editData('not.exist')
    })

    // clean up
    //
    it('Delete Project', () => {
        projectsPage.deleteProject(projectName)
    })

})



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
