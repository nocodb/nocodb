
// main page
export class _mainPage {

    constructor() {

        // Top Right items
        this.SHARE = 0
        this.THEME_BODY = 1
        this.THEME_HEADER = 2
        this.ALERT = 3
        this.LANGUAGE = 4
        this.USER = 5

        // Top Left items
        this.HOME = 0
        this.GIT_HOME = 1
        this.GIT_STAR = 2
        this.GIT_DOCS = 3

        this.AUDIT = 0
        this.APPSTORE = 2
        this.TEAM_N_AUTH = 3
        this.PROJ_METADATA = 4
        this.ROLE_VIEW = 5
    }

    toolBarTopLeft(toolBarItem) {
        return cy.get('header.v-toolbar').eq(0).find('a').eq(toolBarItem)
    }

    toolBarTopRight(toolBarItem) {
        return cy.get('header.v-toolbar').eq(0).find('button').eq(toolBarItem)
    }


    navigationDraw(item) {
        if (item == this.ROLE_VIEW)
            return cy.get('.nc-nav-drawer').find('.v-list').last()
        else
            return cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').eq(item)
    }


    // add new user to specified role
    //
    addNewUserToProject = (userCred, roleType) => {

        let linkText

        // click on New User button, feed details
        cy.get('button:contains("New User")').first().click()
        cy.get('label:contains("Email")').next('input').type(userCred.username).trigger('input')
        cy.get('label:contains("Select User roles")').click()

        // opt-in requested role & submit
        // note that, 'editor' is set by default
        //
        cy.getActiveMenu().contains(roleType).click()
        cy.getActiveMenu().contains('editor').click()
        cy.get('.mdi-menu-down').click()
        cy.get('.nc-invite-or-save-btn').click()

        // get URL, invoke
        cy.getActiveModal().find('.v-alert').then(($obj) => {
            linkText = $obj.text()
            cy.log(linkText)

            cy.visit(linkText)

            cy.wait(3000)

            // Redirected to new URL, feed details
            //
            cy.get('input[type="text"]').type(userCred.username)
            cy.get('input[type="password"]').type(userCred.password)
            cy.get('button:contains("SIGN UP")').click()

            cy.url({ timeout: 6000 }).should('contain', '#/project')
            cy.wait(1000)            
        })
    }

    addExistingUserToProject = (emailId, role) => {

        cy.get('.v-list-item:contains("Team & Auth")').click()
        cy.get(`tr:contains(${emailId})`).find('.mdi-plus', {timeout: 2000}).click()
        cy.get(`tr:contains(${emailId})`).find('.mdi-pencil-outline', {timeout: 2000}).click()

        cy.get('label:contains(Select User roles)').click()

        // opt-in requested role & submit
        // note that, 'editor' is set by default
        //
        cy.getActiveMenu().contains(role).click()
        cy.getActiveMenu().contains('editor').click()
        cy.get('.mdi-menu-down').click()
        cy.get('.nc-invite-or-save-btn').click()  
        cy.wait(1000)       
    }

    getCell = (columnHeader, cellNumber) => {
        return cy.get(`tbody > :nth-child(${cellNumber}) > [data-col="${columnHeader}"]`)
    }

    getPagination = (pageNumber) => {
        if(pageNumber == '<')
            return cy.get('.nc-pagination .v-pagination > li:first-child')
        if(pageNumber == '>')
            return cy.get('.nc-pagination .v-pagination > li:last-child')
            
        return cy.get(`.nc-pagination .v-pagination > li:contains(${pageNumber}) button`)
    }

    getRow = (rowIndex) => {
        return cy.get('.xc-row-table').find('tr').eq(rowIndex)
    }
}


export const mainPage = new _mainPage;


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