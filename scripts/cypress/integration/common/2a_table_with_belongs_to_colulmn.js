
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

export const genTest = (type, xcdb) => {
  if(!isTestSuiteActive(type, xcdb)) return;

  describe(`${type.toUpperCase()} api - Table: belongs to, link record`, () => {
    // before(() => loginPage.loginAndOpenProject(type))
    
    it('Table column header, URL validation', () => {
      cy.openTableTab('Country')

      // column name validation
      cy.get(`.project-tab:contains(Country):visible`).should('exist')
      // URL validation
      cy.url().should('contain', `name=Country`)
    })

    it('Expand belongs-to column', () => {

      // expand first row
      cy.get('td[data-col="Country => City"] div:visible', {timeout: 12000}).first().click()
      cy.get('td[data-col="Country => City"] div .mdi-arrow-expand:visible').first().click()
    })

    it('Expand Link record, validate', () => {
      cy.getActiveModal().find('button:contains(Link to \'City\')').click()
      cy.wait(1000)

      // Link record form validation
      cy.getActiveModal().contains('Link Record').should('exist')
      cy.getActiveModal().find('button.mdi-reload').should('exist')
      cy.getActiveModal().find('button:contains("New Record")').should('exist')
      cy.getActiveModal().find('.child-card').eq(0).contains('Batna').should('exist')

      cy.getActiveModal().find('button.mdi-close').click()
      cy.wait(200)
      cy.getActiveModal().find('button.mdi-close').click()
    })
  })
}

// genTest('rest')
// genTest('graphql')


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
