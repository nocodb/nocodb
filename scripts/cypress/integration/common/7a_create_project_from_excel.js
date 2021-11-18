
// Cypress test suite: Project creation using EXCEL
//

import { projectsPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"

// stores sheet names (table name)
let sheetList

// stores table data (read from excel)
let sheetData

let filepath = `sampleFiles/simple.xlsx`
let expectedData = {
    0: ['number', 'Number'],
    1: ['float', 'Decimal'],
    2: ['text', 'SingleLineText']
}

// let filepath = `sampleFiles/sample.xlsx`
// let expectedData = {
//     0: ['number', 'Number'],
//     1: ['float', 'Decimal'],
//     2: ['text', 'SingleLineText']
// }

export const genTest = (type, xcdb) => {
    if (!isTestSuiteActive(type, xcdb)) return;
    
    describe(`Import from excel`, () => {

        before(() => {
            // cy.waitForSpinners()
            // cy.signinOrSignup(roles.owner.credentials)
            // cy.wait(2000)

            cy.task('readSheetList', { file: `./scripts/cypress/fixtures/${filepath}` })
                .then((rows) => {
                    cy.log(rows)
                    sheetList = rows
            })

            cy.task('readXlsx', { file: `./scripts/cypress/fixtures/${filepath}`, sheet: "Sheet2" })
                .then((rows) => {
                    cy.log(rows)
                    sheetData = rows
            })            
        })

        it('Upload excel as template', () => {

            mainPage.toolBarTopLeft(mainPage.HOME).click()

            // click on "New Project" 
            cy.get(':nth-child(5) > .v-btn', { timeout: 20000 }).click()
            
            // Subsequent form, select (+ Create) option
            cy.get('.nc-create-project-from-excel', { timeout: 20000 }).click({ force: true })

            cy.get('.nc-excel-import-input').attachFile(filepath)
            cy.get('.nc-btn-use-template', { timeout: 120000 }).should('exist')
        })

        it('Verify pre-load template page', () => {

            cy.getActiveContentModal().find('.v-expansion-panel').then((sheets) => {

                for (let i = 0; i < sheets.length; i++) {

                    // verify if all sheet names are correct
                    cy.wrap(sheets[i]).find('.title').then((blk) => {
                        cy.log(blk.text().trim())
                        expect(blk.text().trim()).to.equal(sheetList[i])
                    })

                    // for each sheet, expand to verify table names & their data types
                    cy.wrap(sheets[i]).find('.mdi-chevron-down').click()
                    cy.wait(500)
                    cy.get('.v-data-table').find('tr:visible').then((row) => {

                        for (let j = 1; j < row.length; j++) {

                            // column name to match input in excel
                            cy.wrap(row[j]).find('[placeholder="Column name"]').then((obj) => {
                                cy.log(obj[0].value)
                                expect(obj[0].value).to.equal(expectedData[j-1][0])
                            })

                            // datatype to match expected output
                            cy.wrap(row[j]).find('span.caption').then((obj) => {
                                cy.log(obj[0].innerText)
                                expect(obj[0].innerText).to.equal(expectedData[j-1][1])
                            })
                        }
                    })

                    // unwind
                    cy.wrap(sheets[i]).find('.mdi-chevron-down').click()
                }
            })
        })

        it('Verify loaded data', () => {

            // create rest/ gql project
            cy.get('.nc-btn-use-template', { timeout: 120000 }).click()
            // if (type == 'rest') {
            //     cy.getActiveMenu().find('[role="menuitem"]').contains('REST').click()
            // } else {
            //     cy.getActiveMenu().find('[role="menuitem"]').contains('GQL').click()
            // }
            
            // wait for loading to be completed
            projectsPage.waitHomePageLoad()
            
            // open sheet & validate contents
            // sheetData contains data read from excel in format
            // 0: { float: 1.1, number: 1, text: "abc" }
            // 1: { float: 1.2, number: 0, text: "def" }           
  
            cy.openTableTab('Sheet2')
            for (const [key, value] of Object.entries(expectedData)) {
                mainPage.getCell(value[0], 1).contains(sheetData[0][value[0]]).should('exist')
                mainPage.getCell(value[0], 2).contains(sheetData[1][value[0]]).should('exist')
            }
            cy.closeTableTab('Sheet2')

            cy.openTableTab('Sheet3')
            for (const [key, value] of Object.entries(expectedData)) {
                mainPage.getCell(value[0], 1).contains(sheetData[0][value[0]]).should('exist')
                mainPage.getCell(value[0], 2).contains(sheetData[1][value[0]]).should('exist')
            }
            cy.closeTableTab('Sheet3')
        })

        after(() => {
            // delete project once all operations are completed
            mainPage.toolBarTopLeft(mainPage.HOME).click()
            cy.wait(1000)
            cy.get(`.nc-${type}-project-row .mdi-delete-circle-outline`, { timeout: 10000 })
                .last()
                .invoke('show')
                .click();
            cy.contains('Submit')
                .closest('button')
                .click();
        })
    })
}


// if (typeof require !== 'undefined') XLSX = require('xlsx');

// let workbook

// const getSheetList = (wb) => {
//     return wb.SheetNames
// }

// const getRow = (sheet, rowIdx) => {
//     let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], {
//         header: 1,
//         blankrows: false
//     });

//     return sheetData[rowIdx]
// }

// // https://stackoverflow.com/questions/40630606/how-to-read-only-column-a-value-from-excel-using-nodejs
// const getColumn = (sheet, colIdx) => {
//     let columnA = []
//     const worksheet = workbook.Sheets[sheet];
//         for (let z in worksheet) {
//             if (z.toString()[0] === colIdx) {
//                 columnA.push(worksheet[z].v);
//         }
//     }
//     return columnA    
// }

// const getCell = (sheet, cellIdx) => {
//     const worksheet = workbook.Sheets[sheet];
//     var desired_cell = worksheet[cellIdx];
//     desired_value = (desired_cell ? desired_cell.v : undefined);
//     return desired_value
// }

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
