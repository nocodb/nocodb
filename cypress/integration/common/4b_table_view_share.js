import { mainPage } from "../../support/page_objects/mainPage"
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

let baseURL = ''
let linkText = ''

const generateLinkWithPwd = () => {

    cy.get('.v-navigation-drawer__content > .container')
        .find('.v-list > .v-list-item')
        .contains('Share View')
        .click()
    
    // wait, as URL initially will be /undefined
    cy.wait(500)

    // enable checkbox & feed pwd, save
    cy.getActiveModal().find('[role="switch"][type="checkbox"]').click( {force: true} )
    cy.getActiveModal().find('input[type="password"]').type('123456')
    cy.getActiveModal().find('button:contains("Save password")').click()

    // copy link text, visit URL
    cy.getActiveModal().find('.share-link-box')
        .then(($obj) => {

            linkText = $obj.text()
            cy.log(linkText)
        })
}

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} api - Shared VIEWs (GRID)`, () => {

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            cy.openTableTab('City')
            // store base URL- to re-visit and delete form view later
            cy.url().then((url) => {
                baseURL = url
            })
            
            generateLinkWithPwd()
        })

        beforeEach(() => {
            cy.restoreLocalStorage();
        })

        afterEach(() => {
            cy.saveLocalStorage();
        })

        it('Share view with correct password', () => {
            cy.visit(linkText)
            // wait for share view page to load!
            cy.wait(1000)
            // feed password
            cy.getActiveModal().find('input[type="password"]').type('123456')
            cy.getActiveModal().find('button:contains("Unlock")').click()
            cy.wait(1000)

            // if pwd is incorrect, active modal requesting to feed in password again will persist
            cy.get('body').find('.v-dialog.v-dialog--active').should('not.exist')
        })

        it('Share view with incorrect password', () => {
            cy.visit(linkText)
            // wait for share view page to load!
            cy.wait(1000)
            // feed password
            cy.getActiveModal().find('input[type="password"]').type('abc')
            cy.getActiveModal().find('button:contains("Unlock")').click()
            cy.wait(1000)

            // if pwd is incorrect, active modal requesting to feed in password again will persist
            cy.get('body').find('.v-dialog.v-dialog--active').should('exist')
        })

        it('Delete view', () => {
            cy.visit(baseURL)
            mainPage.deleteCreatedViews()
        })

        after(() => {
            cy.get('[href="#table||db||City"]').find('button.mdi-close').click()
        })
    })
}

// genTest('rest', false)
// genTest('graphql', false)

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