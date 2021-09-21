
import { loginPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"

const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Table Column`, () => {
    const name = 'Table' + Date.now();
    const colName = 'column_name' + Date.now();
    const updatedColName = 'updated_column_name'

    before(() => {
      loginPage.loginAndOpenProject(type)
      cy.createTable(name)
    });

    // delete table
    after(() => {
      cy.deleteTable(name)
    });

    it('Create Table Column', () => {
      cy.get(`.project-tab:contains(${name}):visible`).should('exist')
      mainPage.addColumn(colName)

      cy.get(`th:contains(${colName})`).should('exist');

      // wait for pop up's to exit
      cy.wait(3000)
    })

    // edit the newly created column
    it('Edit table column - change datatype', () => {
      cy.get(`th:contains(${colName}) .mdi-menu-down`)
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()

      // change column type and verify
      cy.get('.nc-ui-dt-dropdown').click()
      cy.contains('LongText').click()
      cy.get('.nc-col-create-or-edit-card').contains('Save').click()

      cy.get(`th[data-col="${colName}"] .mdi-text-subject`).should('exist')

      cy.get(`th:contains(${colName}) .mdi-menu-down`)
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()
    })

    // edit the newly created column
    it('Edit table column - rename', () => {
      cy.get(`th:contains(${colName}) .mdi-menu-down`)
        .trigger('mouseover', {force: true})
        .click({force: true})

      cy.get('.nc-column-edit').click()

      // rename column and verify
      cy.get('.nc-column-name-input input').clear().type(updatedColName)
      cy.get('.nc-col-create-or-edit-card').contains('Save').click()

      cy.wait(3000)

      cy.get(`th:contains(${colName})`).should('not.exist')
      cy.get(`th:contains(${updatedColName})`).should('exist')
    })

    // delete the newly created column
    it('Delete table column', () => {
      cy.get(`th:contains(${updatedColName})`).should('exist');

      cy.get(`th:contains(${updatedColName}) .mdi-menu-down`)
        .trigger('mouseover')
        .click()

      cy.get('.nc-column-delete').click()
      cy.get('button:contains(Confirm)').click()

      cy.get(`th:contains(${updatedColName})`).should('not.exist');
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

