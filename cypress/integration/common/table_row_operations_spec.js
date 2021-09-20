
import { loginPage } from "../../support/page_objects/navigation"

const genTest = (type) => {

  describe(`${type.toUpperCase()} api - Table Row`, () => {
    const randVal = 'Test' + Date.now();
    const updatedRandVal = 'Updated' + Date.now();
    const name = 'Tablerow' + Date.now();

    before(() => {
      loginPage.loginAndOpenProject(type)
      cy.createTable(name)
    });

    // delete table
    after(() => {
      cy.deleteTable(name)
    });

    it('Add new row', () => {
      cy.get('.nc-add-new-row-btn').click({force: true});
      cy.get('#data-table-form-Title > input').first().type(randVal);
      cy.contains('Save Row').filter('button').click({force: true})
      cy.get('td', {timeout: 10000}).contains(randVal).should('exist');
    })

    it('Update row', () => {
      cy.get('td').contains(randVal)
        .closest('tr')
        .find('.nc-row-expand-icon')
        .click({force: true});

      cy.get('#data-table-form-Title > input').first().clear().type(updatedRandVal);
      cy.contains('Save Row').filter('button').click({force: true})

      cy.wait(3000)
      cy.get('td').contains(randVal).should('not.exist');
      cy.get('td').contains(updatedRandVal).should('exist');
    })

    it('Delete row', () => {
      cy.get('td').contains(updatedRandVal).rightclick({force: true})

      // delete row
      cy.getActiveMenu().find('.v-list-item:contains("Delete Row")').first().click({force: true})
      cy.wait(1000)
      cy.get('td').contains(randVal).should('not.exist');
    })
  });
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

