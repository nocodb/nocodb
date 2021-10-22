
import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"
import { mainPage } from "../../support/page_objects/mainPage";

export const genTest = (type, xcdb) => {
  if(!isTestSuiteActive(type, xcdb)) return;

  describe(`${xcdb ? 'Meta - ' : ''}${type.toUpperCase()} api - Table`, () => {

    before(() => {
      //loginPage.loginAndOpenProject(type, xcdb)
      cy.get('.mdi-close').click({ multiple: true })
    })
      
    after(() => {
      cy.get('.mdi-close').click({ multiple: true })
    })

    const name = 'tablex'

    // create a new random table
    it('Create Table', () => {
      cy.get('.add-btn').click();
      cy.get('.nc-create-table-card .nc-table-name input[type="text"]')
        .first().click().clear().type(name)

      if (!xcdb) {
        cy.get('.nc-create-table-card .nc-table-name-alias input[type="text"]')
          .first().should('have.value', name.toLowerCase())
      }
      //cy.wait(5000)

      cy.get('.nc-create-table-card .nc-create-table-submit').first().click()
      cy.get(`.project-tab:contains(${name})`).should('exist')
      cy.url().should('contain', `name=${name}`)

      //cy.wait(5000)
    })


    // delete newly created table
    it('Delete Table', () => {

      cy.get('.nc-project-tree').find('.v-list-item__title:contains(Tables)', {timeout: 10000})
        .first().click()

      cy.get('.nc-project-tree').contains(name, {timeout: 6000}).first().click({force: true});
      cy.get(`.project-tab:contains(${name}):visible`).should('exist')
      cy.get('.nc-table-delete-btn:visible').click()
      cy.get('button:contains(Submit)').click()
      cy.get(`.project-tab:contains(${name}):visible`).first().should('not.exist')
    })

    const getAuditCell = (row, col) => {
        return cy.get('table > tbody > tr').eq(row).find('td').eq(col)
    }

    it('Open Audit tab', ()=> {
        mainPage.navigationDraw(mainPage.AUDIT).click()
        cy.wait(2000)

        // Audit table entries
        //  [Header] Operation Type, Operation Sub Type, Description, User, Created
        //  [0] TABLE, DELETED, delete table table-x, user@nocodb.com, ...
        //  [1] TABLE, Created, created table table-x, user@nocodb.com, ...

        getAuditCell(0,0).contains('TABLE').should('exist')
        getAuditCell(0,1).contains('DELETED').should('exist')
        getAuditCell(0,3).contains('user@nocodb.com').should('exist')

        getAuditCell(1,0).contains('TABLE').should('exist')
        getAuditCell(1,1).contains('CREATED').should('exist')
        getAuditCell(1,3).contains('user@nocodb.com').should('exist')        
    })    
  })
}


// genTest('rest', false)
// genTest('graphql', false)
// genTest('rest', true)
// genTest('graphql', true)

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