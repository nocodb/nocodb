
import { mainPage } from "../../support/page_objects/mainPage"
import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    describe(`${type.toUpperCase()} Columns of type attachment`, () => {
        before(() => {
            loginPage.loginAndOpenProject(type)
            cy.openTableTab('Country');
        })

        after(() => {
            mainPage.deleteColumn('testAttach')

            // clean up newly added rows into Country table operations
            // this auto verifies successfull addition of rows to table as well
            mainPage.getPagination(5).click()
            cy.wait(3000)
            mainPage.getRow(10).find('.mdi-checkbox-blank-outline').click({ force: true })
              
            mainPage.getCell("Country", 10).rightclick()
            cy.getActiveMenu().contains('Delete Selected Row').click()
            
            cy.closeTableTab('Country')          
        })
        
        it(`Add column of type attachments`, () => {
            mainPage.addColumnWithType('testAttach', 'Attachment')
            cy.wait(4000)
            for (let i = 1; i <= 2; i++) {
                let filepath = `sampleFiles/${i}.json`
                mainPage.getCell('testAttach', i).click().find('input[type="file"]').attachFile(filepath)
                cy.wait(4000)      
            }
        })

        it(`Form view with Attachment field- Submit & verify`, () => {
            // create form-view
            cy.get(`.nc-create-form-view`).click();
            cy.getActiveModal().find('button:contains(Submit)').click()

            cy.get(`.nc-view-item.nc-form-view-item`).contains('Country1').click()
            cy.get('.v-navigation-drawer__content > .container')
                .find('.v-list > .v-list-item')
                .contains('Share View')
                .click()

            // copy link text, visit URL
            cy.getActiveModal().find('.share-link-box')
                .contains('/nc/form/', { timeout: 10000 })
                .then(($obj) => {

                    let linkText = $obj.text()
                    cy.log(linkText)
                    cy.visit(linkText)
            
                    // wait for share view page to load!
                    cy.wait(5000)

                    cy.get('#data-table-form-Country').type('_abc')
                    cy.get('#data-table-form-LastUpdate').click()
                    cy.getActiveModal().find('button').contains('19').click()
                    cy.getActiveModal().find('button').contains('OK').click()

                    cy.get('.nc-field-editables')
                        .last()
                        .find('input[type="file"]')
                        .attachFile(`sampleFiles/1.json`)

                    // submit button & validate
                    cy.get('.nc-form').find('button').contains('Submit').click()
                    cy.wait(3000)
                })
        })

        it(`Filter column which contain only attachments, download CSV`, () => {
            // come back to main window
            loginPage.loginAndOpenProject(type)
            cy.openTableTab('Country');
            
            mainPage.filterField('testAttach', 'is not null', null)
            cy.wait(1000)
            mainPage.hideUnhideField('LastUpdate')

            const verifyCsv = (retrievedRecords) => {
                let storedRecords = [
                    `Country,Country => City,testAttach`,
                    `Afghanistan,Kabul,1.json(http://localhost:8080/dl/externalrest_5agd/db/country/testAttach_VWk3fz_1.json)`
                ]
                
                expect(retrievedRecords[0]).to.be.equal(storedRecords[0])
                for (let i = 1; i < storedRecords.length; i++) {
                    const columns = retrievedRecords[i].split(',')
                    expect(columns[2]).to.contain('.json(http://localhost:8080/dl/external')
                }
                
                cy.log(retrievedRecords[109])
                cy.log(retrievedRecords[110])
                cy.log(retrievedRecords[111])
            }

            mainPage.downloadAndVerifyCsv(`Country_exported_1.csv`, verifyCsv)
            mainPage.hideUnhideField('LastUpdate')
            mainPage.filterReset()
        })
    })
}

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
