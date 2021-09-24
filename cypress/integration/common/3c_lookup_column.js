
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} api - LookUp column`, () => {

        // to retrieve few v-input nodes from their label
        //
        const fetchParentFromLabel = (label) => {
            cy.get('label')
                .contains(label)
                .parents('.v-input')
                .click()
        }

        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            loginPage.loginAndOpenProject(type)

            // open a table to work on views
            //
            cy.openTableTab('City');
        })

        // Routine to create a new look up column
        //
        const addLookUpColumn = (childTable, childCol) => {

            // (+) icon at end of column header (to add a new column)
            // opens up a pop up window
            //
            cy.get('.new-column-header').click()

            // Redundant to feed column name. as alias is displayed & referred for
            cy.get('.nc-column-name-input input').clear().type(childCol)

            // Column data type: to be set to lookup in this context
            cy.get('.nc-ui-dt-dropdown').click()
            cy.getActiveMenu().contains('Lookup').click()

            // Configure Child table & column names
            fetchParentFromLabel('Child Table')
            cy.getActiveMenu().contains(childTable).click()

            fetchParentFromLabel('Child column')
            cy.getActiveMenu().contains(childCol).click()

            // click on Save
            cy.get('.nc-col-create-or-edit-card').contains('Save').click()
            cy.wait(1000)

            // Verify if column exists. 
            //
            cy.get(`th:contains(${childCol})`)
                .should('exist');
            cy.wait(500)

        }

        // routine to delete column
        //
        const deleteColumnByName = (childCol) => {

            // verify if column exists before delete
            cy.get(`th:contains(${childCol})`)
                .should('exist');

            // delete opiton visible on mouse-over
            cy.get(`th:contains(${childCol}) .mdi-menu-down`)
                .trigger('mouseover')
                .click()

            // delete/ confirm on pop-up
            cy.get('.nc-column-delete').click()
            cy.getActiveModal().find('button:contains(Confirm)').click()

            // validate if deleted (column shouldnt exist)
            cy.get(`th:contains(${childCol})`)
                .should('not.exist');

        }

        ///////////////////////////////////////////////////
        // Test case

        it('Add Lookup column (Address, District) & Delete', () => {

            addLookUpColumn('Address', 'District')

            // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
            cy.get(`tbody > :nth-child(1) > [data-col="District (from Address)"]`)
                .contains('Galicia')
                .should('exist')

            deleteColumnByName('District')

        })

        it('Add Lookup column (Country, CountryId) & Delete', () => {

            addLookUpColumn('Country', 'CountryId')

            // Verify first entry, will be displayed as alias here 'childColumn (from childTable)'
            cy.get(`tbody > :nth-child(1) > [data-col="CountryId (from Country)"]`)
                .contains('87')
                .should('exist')

            deleteColumnByName('CountryId')

        })

    });
}


genTest('rest', false)
genTest('graphql', false)

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