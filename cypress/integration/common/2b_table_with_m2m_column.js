
import { loginPage } from "../../support/page_objects/navigation"

const genTest = (type) => {

  describe(`${type.toUpperCase()} api - M2M Column validation`, () => {
    before(() => {
      loginPage.loginAndOpenProject(type)
      cy.openTableTab('Actor')
    })
    
    it('Table column header, URL validation', () => {

      // column name validation
      cy.get(`.project-tab:contains(Actor):visible`).should('exist')
      // URL validation
      cy.url().should('contain', `?name=Actor&`)
    })

    it('Expand m2m column', () => {

      // expand first row
      cy.get('td[data-col="Actor <=> Film"] div', {timeout: 12000}).first().click({force: true})
      cy.get('td[data-col="Actor <=> Film"] div .mdi-arrow-expand').first().click({force: true})

      // validations
      cy.getActiveModal().contains('Film').should('exist')
      cy.getActiveModal().find('button.mdi-reload').should('exist')
      cy.getActiveModal().find('button:contains(Link to \'Film\')').should('exist')
      cy.getActiveModal().find('.child-card').eq(0).contains('ACADEMY DINOSAUR').should('exist')
    })

    it('Expand "Link to" record, validate', () => {
      cy.getActiveModal().find('button:contains(Link to \'Film\')').click()
      cy.wait(1000)

      // Link record form validation
      cy.getActiveModal().contains('Link Record').should('exist')
      cy.getActiveModal().find('button.mdi-reload').should('exist')
      cy.getActiveModal().find('button:contains("New Record")').should('exist')
      cy.getActiveModal().find('.child-card').eq(0).contains('ACE GOLDFINGER').should('exist')
      cy.get('body').type('{esc}')
    })

    it('Expand first linked card, validate', () => {
      cy.getActiveModal().find('.child-card').eq(0).contains('ACADEMY DINOSAUR', {timeout: 2000}).click()
      cy.wait(1000)

      // Link card validation
      cy.getActiveModal().find('h5').contains("ACADEMY DINOSAUR").should('exist')
      cy.getActiveModal().find('button:contains("Save Row")').should('exist')
      cy.getActiveModal().find('button:contains("Cancel")').should('exist')
    })
  })
}

genTest('rest')
genTest('graphql')


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

