
import { mainPage } from "../../support/page_objects/mainPage"
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

export const genTest = (type, xcdb) => {
  if(!isTestSuiteActive(type, xcdb)) return;

  describe(`${type.toUpperCase()} api - Filter, Fields, Sort`, () => {
    before(() => {
      // loginPage.loginAndOpenProject(type)

      // open country table
      cy.openTableTab('Country');
      cy.wait(2000)

    })

    after(() => {
      cy.closeTableTab('Country')
    })    

    describe(`Pagination`, () => {
      // check pagination
      it('Check country table - Pagination', () => {
        cy.get('.nc-pagination').should('exist')

        // verify > pagination option
        mainPage.getPagination('>').click()
        mainPage.getPagination(2).should('have.class', 'v-pagination__item--active')

        // verify < pagination option
        mainPage.getPagination('<').click()
        mainPage.getPagination(1).should('have.class', 'v-pagination__item--active')
      })
    })


    describe(`Row operations`, () => {
      // create new row using + button in header
      //
      it('Add row using tool header button', () => {

        // add a row to end of Country table
        cy.get('.nc-add-new-row-btn').click();
        cy.get('#data-table-form-Country > input').first().type('Test Country');
        cy.contains('Save Row').filter('button').click()

        // verify
        mainPage.getPagination(5).click()
        mainPage.getCell("Country", 10).contains("Test Country").should('exist')
      })

      // delete slingle row
      //
      it('Delete row', () => {
        // delete row added in previous step
        mainPage.getCell("Country", 10).rightclick()
        cy.getActiveMenu().contains('Delete Row').click()

        // verify
        mainPage.getCell("Country", 10).should('not.exist')
      })

      // create new row using right click menu option
      //
      it('Add row using rightclick menu option', () => {
        mainPage.getPagination(5).click()

        mainPage.getCell("Country", 9).rightclick()
        cy.getActiveMenu().contains('Insert New Row').click()
        mainPage.getCell("Country", 10).dblclick().type('Test Country-1{enter}')

        mainPage.getCell("Country", 10).rightclick()
        cy.getActiveMenu().contains('Insert New Row').click()
        mainPage.getCell("Country", 11).dblclick().type('Test Country-2{enter}')

        // verify
        mainPage.getCell("Country", 10).contains("Test Country-1").should('exist')
        mainPage.getCell("Country", 11).contains("Test Country-2").should('exist')  
      })    

      // delete selected rows (multiple)
      //
      it('Delete Selected', () => {
        mainPage.getRow(10).find('.mdi-checkbox-blank-outline').click({force: true})
        mainPage.getRow(11).find('.mdi-checkbox-blank-outline').click({force: true})

        mainPage.getCell("Country", 10).rightclick()
        cy.getActiveMenu().contains('Delete Selected Row').click()

        // verify
        mainPage.getCell("Country", 10).should('not.exist')
        mainPage.getCell("Country", 11).should('not.exist')   

        cy.wait(1000)
        mainPage.getPagination(1).click()
      })

    })

    
    describe(`Sort operations`, () => {
      it('Enable sort', () => {
        // Sort menu operations (Country Column, Z->A)
        cy.get('.nc-sort-menu-btn').click()
        cy.contains('Add Sort Option').click();
        cy.get('.nc-sort-field-select div').first().click()
        cy.get('.menuable__content__active .v-list-item:contains(Country)').click()
        cy.get('.nc-sort-dir-select div').first().click()
        cy.get('.menuable__content__active .v-list-item:contains("Z -> A")').click()
        
        cy.contains('Zambia').should('exist')
      })

      it('Disable sort', () => {
        // remove sort and validate
        cy.get('.nc-sort-item-remove-btn').click()
        cy.contains('Zambia').should('not.exist')
      })

    })


    describe('Field Operation', () => {
      // before(() => {
      //   cy.get('.nc-fields-menu-btn').click()
      // })

      it('Hide field', () => {
        cy.get('th:contains(LastUpdate)').should('be.visible')

        // toggle and confirm it's hidden
        cy.get('.nc-fields-menu-btn').click()
        cy.get('.menuable__content__active .v-list-item label:contains(LastUpdate)').click()
        cy.get('.nc-fields-menu-btn').click()
        cy.get('th:contains(LastUpdate)').should('not.be.visible')
      })

      it('Show field', () => {
        cy.get('.nc-fields-menu-btn').click()
        cy.get('.menuable__content__active .v-list-item label:contains(LastUpdate)').click()
        cy.get('.nc-fields-menu-btn').click()
        cy.get('th:contains(LastUpdate)').should('be.visible')
      })
    })


    describe('Filter operations', () => {
      it('Create Filter', () => {
        cy.get('.nc-filter-menu-btn').click()
        cy.contains('Add Filter').click();

        cy.get('.nc-filter-field-select').last().click();
        cy.getActiveMenu().find('.v-list-item:contains(Country)').click()
        cy.get('.nc-filter-operation-select').last().click();
        cy.getActiveMenu().find('.v-list-item:contains("is equal")').click()
        cy.get('.nc-filter-value-select input:text').last().type('India');
        // cy.getActiveMenu().find('button:contains("Apply changes")').click()
        cy.get('.nc-filter-menu-btn').click()
        cy.wait(1000)

        cy.get('td:contains(India)').should('exist')
      })

      it('Delete Filter', () => {
        // remove sort and check
        cy.get('.nc-filter-menu-btn').click()
        cy.get('.nc-filter-item-remove-btn').click()
        // cy.getActiveMenu().find('button:contains("Apply changes")').click()
        cy.get('.nc-filter-menu-btn').click()      
        cy.contains('td:contains(India)').should('not.exist')
      })
    })
  })
}

// genTest('rest', false)
// genTest('graphql', false)

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