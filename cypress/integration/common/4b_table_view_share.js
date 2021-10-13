import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

const shareViewWithPwd = (pwdCorrect, pwd) => {

    cy.get('.v-navigation-drawer__content > .container')
        .find('.v-list > .v-list-item')
        .contains('Share View')
        .click()

    // No password- unprotected link
    if(''==pwd) {

        // copy link text, visit URL
        cy.getActiveModal().find('.share-link-box')
            .contains('http', {timeout: 10000})
            .then(($obj) => {

                let linkText = $obj.text()
                cy.log(linkText)
                cy.visit(linkText)
        
                // wait for share view page to load!
                cy.wait(5000)
                cy.get('body').find('.v-dialog.v-dialog--active').should('not.exist')
            })

    // password protected link
    } else {

        // enable checkbox & feed pwd, save
        cy.getActiveModal().find('[role="switch"][type="checkbox"]').click( {force: true} )
        cy.getActiveModal().find('input[type="password"]').type('123456')
        cy.getActiveModal().find('button:contains("Save password")').click()

        // copy link text, visit URL
        cy.getActiveModal().find('.share-link-box')
            .then(($obj) => {

                let linkText = $obj.text()
                cy.log(linkText)
                cy.visit(linkText)
        
                // wait for share view page to load!
                cy.wait(5000)
        
                // feed password
                cy.getActiveModal().find('input[type="password"]').type(pwd)
                cy.getActiveModal().find('button:contains("Unlock")').click()
        
                cy.wait(1000)
        
                // if pwd is incorrect, active modal requesting to feed in password again 
                // will remain
                if(pwdCorrect) {
                    cy.get('body').find('.v-dialog.v-dialog--active').should('not.exist')
                }
                else {
                    cy.get('body').find('.v-dialog.v-dialog--active').should('exist')
                }
        })       
    }
}


// delete created views
//
const deleteCreatedViews = () => {
    cy.get('.v-navigation-drawer__content > .container')
        .find('.v-list > .v-list-item')
        .contains('Share View')
        .parent().find('button.mdi-dots-vertical').click()

    cy.getActiveMenu().find('.v-list-item').contains('Views List').click()

    cy.get(1000)

    cy.get('th:contains("View Link")').parent().parent()
        .next().find('tr').each((tableRow) => {
            cy.wrap(tableRow).find('button').last().click()
            cy.wait(1000)
        })
}

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} api - Clipboard access`, () => {

        // Run once before test- create project (rest/graphql)
        //
        beforeEach(() => {
            // loginPage.loginAndOpenProject(type)
            cy.openTableTab('City');
        })

        it('Share view without password', () => {
            shareViewWithPwd(true, '')
        })

        it('Share view with correct password', () => {
            shareViewWithPwd(true, '123456')
        })

        it('Share view with incorrect password', () => {
            shareViewWithPwd(false, 'abc')
        })

        it('Delete view', deleteCreatedViews )

        after(() => {
            cy.get('[href="#table||db||City"]').find('button.mdi-close').click()
        })            
        // // clean up
        // after( () => {
        //     loginPage.signIn({ username: 'user@nocodb.com', password: 'Password123.' })
        //     projectsPage.deleteProject(projectName)
        // })
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