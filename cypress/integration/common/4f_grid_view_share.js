import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"
import { mainPage } from "../../support/page_objects/mainPage"

let baseURL = ''
let viewURL = []

export const genTest = (type, xcdb) => {
  if(!isTestSuiteActive(type, xcdb)) return;

  describe(`${type.toUpperCase()} api - Table views`, () => {

    const name = 'Test' + Date.now();

    // Run once before test- create project (rest/graphql)
    //
    before(() => {
        // loginPage.loginAndOpenProject(type)

        // open a table to work on views
        //
        cy.openTableTab('Country');
    })

    beforeEach(() => {
        cy.restoreLocalStorage();
    })

    afterEach(() => {
        cy.saveLocalStorage();
    })
      
    after(() => {
        // close table
        cy.get('[href="#table||db||Country"]').find('button.mdi-close').click()
    })      
      
    const generateViewLink = () => {
        // click on share view 
        cy.get('.v-navigation-drawer__content > .container')
            .find('.v-list > .v-list-item')
            .contains('Share View')
            .click()

        // wait, as URL initially will be /undefined
        cy.wait(500)

        // copy link text, visit URL
        cy.getActiveModal().find('.share-link-box')
            .contains('/nc/view/', {timeout: 10000})
            .then(($obj) => {

                cy.get('body').type('{esc}')
                viewURL.push($obj.text())
            })
    }        

    // Common routine to create/edit/delete GRID & GALLERY view
    // Input: viewType - 'grid'/'gallery'
    //
    const viewTest = (viewType) => {
      
        
        it(`Create ${viewType} view`, () => {
            // create a normal public view
            cy.get(`.nc-create-${viewType}-view`).click();
            cy.getActiveModal().find('button:contains(Submit)').click()
            cy.wait(1000)

            // create view for fields verification
            cy.get(`.nc-create-${viewType}-view`).click();
            cy.getActiveModal().find('button:contains(Submit)').click()
            cy.wait(1000)
            
            // create view for Sort verification
            cy.get(`.nc-create-${viewType}-view`).click();
            cy.getActiveModal().find('button:contains(Submit)').click()
            cy.wait(1000)
            
            // create view for Filter verification
            cy.get(`.nc-create-${viewType}-view`).click();
            cy.getActiveModal().find('button:contains(Submit)').click()
            cy.wait(1000)

            // store base URL- to re-visit and delete form view later
            cy.url().then((url) => {
                baseURL = url
            })
        })

        it(`Share ${viewType} view generate URL with all fields enabled`, () => {
            cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country1').click()
            generateViewLink()
            cy.log(viewURL)
        })

        it(`Share ${viewType} view generate URL with a field hidden`, () => {
            cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country2').click()
            mainPage.hideUnhideField('LastUpdate')
            generateViewLink()
        })

        it(`Share ${viewType} view generate URL with a field sorted`, () => {
            cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country3').click()
            mainPage.sortField('Country', 'Z -> A')
            generateViewLink()
        })

        it(`Share ${viewType} view generate URL with a field filtered`, () => {
            cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country4').click()
            mainPage.filterField('Country', 'is equal', 'India')
            generateViewLink()

        })        

        it(`Share ${viewType} view : Access URL with a field hidden`, () => {
            // visit public view
            cy.visit(viewURL[1])
    
            // wait for public view page to load!
            cy.wait(5000)

            // verify column headers
            cy.get('[data-col="Country"]').should('exist')
            cy.get('[data-col="LastUpdate"]').should('not.exist')
            cy.get('[data-col="Country => City"]').should('exist')

            // country column content verification before sort
            mainPage.getCell("Country", 1).contains("Afghanistan").should('exist')
            mainPage.getCell("Country", 2).contains("Algeria").should('exist')
            mainPage.getCell("Country", 3).contains("American Samoa").should('exist')
        })
        
        it(`Share ${viewType} view : Access URL with a field sorted`, () => {
            // visit public view
            cy.visit(viewURL[2])
    
            // wait for public view page to load!
            cy.wait(5000)

            // verify column headers
            cy.get('[data-col="Country"]').should('exist')
            cy.get('[data-col="LastUpdate"]').should('exist')
            cy.get('[data-col="Country => City"]').should('exist')

            // country column content verification before sort
            mainPage.getCell("Country", 1).contains("Zambia").should('exist')
        })
        
        it(`Share ${viewType} view : Access URL with a field filtered`, () => {
            // visit public view
            cy.visit(viewURL[3])
    
            // wait for public view page to load!
            cy.wait(5000)

            // verify column headers
            cy.get('[data-col="Country"]').should('exist')
            cy.get('[data-col="LastUpdate"]').should('exist')
            cy.get('[data-col="Country => City"]').should('exist')

            // country column content verification before sort
            mainPage.getCell("Country", 1).contains("India").should('exist')
        })          

        it(`Share ${viewType} view : Access URL with all fields enabled`, () => {
            // visit public view
            cy.visit(viewURL[0])
    
            // wait for public view page to load!
            cy.wait(5000)

            // verify column headers
            cy.get('[data-col="Country"]').should('exist')
            cy.get('[data-col="LastUpdate"]').should('exist')
            cy.get('[data-col="Country => City"]').should('exist')

            // country column content verification before sort
            mainPage.getCell("Country", 1).contains("Afghanistan").should('exist')
            mainPage.getCell("Country", 2).contains("Algeria").should('exist')
            mainPage.getCell("Country", 3).contains("American Samoa").should('exist')
        })

        it(`Share ${viewType} view : Enable sort`, () => {
            // Sort menu operations (Country Column, Z->A)
            mainPage.sortField('Country', 'Z -> A')
            mainPage.getCell("Country", 1).contains("Zambia").should('exist')
        })

        it(`Share ${viewType} view : Disable sort`, () => {
            // remove sort and validate
            mainPage.clearSort()
            mainPage.getCell("Country", 1).contains("Afghanistan").should('exist')
        })

        it(`Share ${viewType} view : Create Filter`, () => {
            // add filter & validate
            mainPage.filterField('Country', 'is equal', 'India')
            cy.wait(1000)
            mainPage.getCell("Country", 1).contains("India").should('exist')
        })

        it(`Share ${viewType} view : Delete Filter`, () => {
            // Remove sort and Validate
            mainPage.filterReset()
            mainPage.getCell("Country", 1).contains("Afghanistan").should('exist')
        })        

        it(`Delete ${viewType} view`, () => {
            // go back to base page
            cy.visit(baseURL)

            // number of view entries should be 2 before we delete
            cy.get('.nc-view-item').its('length').should('eq', 5)

            // click on delete icon (becomes visible on hovering mouse)
            cy.get('.nc-view-delete-icon').eq(3).click({ force: true })
            cy.wait(1000)

            cy.get('.nc-view-delete-icon').eq(2).click({ force: true })
            cy.wait(1000)            

            cy.get('.nc-view-delete-icon').eq(1).click({ force: true })
            cy.wait(1000)

            cy.get('.nc-view-delete-icon').eq(0).click({ force: true })
            cy.wait(1000)
            
            // confirm if the number of veiw entries is reduced by 1
            cy.get('.nc-view-item').its('length').should('eq', 1)
        })
    }

    // below scenario's will be invoked twice, once for rest & then for graphql
    viewTest('grid')
  })
}

// invoke for different API types supported
//
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
