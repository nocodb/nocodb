
// Cypress test suite: Project creation using EXCEL
//

import { projectsPage } from "../../support/page_objects/navigation"
import { mainPage } from "../../support/page_objects/mainPage"
import { staticProjects, roles, isTestSuiteActive } from "../../support/page_objects/projectConstants"
// import fs from "fs" 

// if (typeof require !== 'undefined') XLSX = require('xlsx');
// let filepath = `sampleFiles/simple.xlsx`

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


export const genTest = (type, xcdb) => {
    if (!isTestSuiteActive(type, xcdb)) return;
    
    describe(`Import from excel`, () => {

        it('Admin SignUp', () => {
            cy.waitForSpinners();
            cy.signinOrSignup(roles.owner.credentials)
            cy.wait(2000)        
        })

        it(``, () => {
            // cy.readFile('simple.xlsx').then((content) => {
            //     workbook = XLSX.read(content)

            //     cy.log(workbook)

            //     cy.log(getSheetList(workbook))
            //     cy.log(getRow('Sheet2', 1))
            //     cy.log(getColumn('Sheet2', 'A'))                
            // })
            // cy.task('readXlsx', { file: 'simple.xlsx', sheet: "Sheet2" }).then((rows) => {
            //     cy.log(rows)
            //     // expect(rows.length).to.equal(543)
            //     // expect(rows[0]["column name"]).to.equal(11060)
            // })
            
            cy.task('readSheetList', { file: 'simple.xlsx' }).then((rows) => {
                cy.log(rows)
                // expect(rows.length).to.equal(543)
                // expect(rows[0]["column name"]).to.equal(11060)
            })
        })

        it.skip('Upload excel as template', () => {

            mainPage.toolBarTopLeft(mainPage.HOME).click()

            // click on "New Project" 
            cy.get(':nth-child(5) > .v-btn', { timeout: 20000 }).click()
            
            // Subsequent form, select (+ Create) option
            cy.get('.nc-create-project-from-excel', { timeout: 20000 }).click({ force: true })

            cy.get('.nc-excel-import-input').attachFile(filepath)
            cy.get('.nc-btn-use-template', { timeout: 120000 }).should('exist')
            
            // validate pre-load template page
            cy.getActiveContentModal().find('.v-expansion-panel').then((panel) => {
                // cy.log(panel.length)
                for (let i = 0; i < panel.length; i++) {
                    // cy.log(panel[i])
                    cy.wrap(panel[i]).find('.title').then((blk) => {
                        cy.log(blk.text().trim())
                    })
                    cy.wrap(panel[i]).find('.mdi-chevron-down').click()
                    cy.wait(1000)
                    cy.get('.v-data-table').find('tr:visible').then((row) => {
                        // cy.log(row)
                        for (let j = 2; j < row.length; j++) {
                            cy.wrap(row[j]).find('[placeholder="Column name"]').then((obj) => {
                                cy.log(obj[0].value)
                            })                            
                            cy.wrap(row[j]).find('span.caption').then((obj) => {
                                cy.log(obj[0].innerText)
                            })
                        }
                    })
                    cy.wrap(panel[i]).find('.mdi-chevron-down').click()
                }
            })
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
