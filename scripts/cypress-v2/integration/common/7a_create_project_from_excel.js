// Cypress test suite: Project creation using EXCEL
//

import { loginPage, projectsPage } from "../../support/page_objects/navigation";
import { mainPage } from "../../support/page_objects/mainPage";
import {
    roles,
    isTestSuiteActive,
} from "../../support/page_objects/projectConstants";

// stores sheet names (table name)
let sheetList;

// stores table data (read from excel)
let sheetData;
//let UrlSheetData

let URL = "https://go.microsoft.com/fwlink/?LinkID=521962";

let filepath = `sampleFiles/simple.xlsx`;
// let UrlFilePath = `sampleFiles/Financial Sample.xlsx`

let expectedData = {
    0: ["number", "Number", "Number"],
    1: ["float", "Decimal", "Float"],
    2: ["text", "SingleLineText", "Text"],
};

// column names with spaces will be converted to include _
let UrlFileExpectedData = {
    0: ["Segment", "SingleSelect", ["Government"]],
    1: ["Country", "SingleSelect", ["Canada"]],
    2: ["Product", "SingleSelect", ["Carretera"]],
    3: ["Discount_Band", "SingleSelect", ["None"]],
    4: ["Units_Sold", "Decimal", [1618.5]],
    5: ["Manufacturing_Price", "Number", [3]],
    6: ["Sale_Price", "Number", [20]],
    7: ["Gross_Sales", "Decimal", [32370]],
    8: ["Discounts", "Decimal", [0]],
    9: ["Sales", "Decimal", [32370]],
    10: ["COGS", "Decimal", [16185]],
    11: ["Profit", "Decimal", [16185]],
    12: ["Date", "Date", ["2014-01-01"]],
    13: ["Month_Number", "Number", [1]],
    14: ["Month_Name", "SingleSelect", ["January"]],
    15: ["Year", "SingleSelect", [2014]],
};

// let filepath = `sampleFiles/sample.xlsx`
// let expectedData = {
//     0:  ['number', 'Number'],
//     1:  ['float', 'Decimal'],
//     2:  ['text', 'SingleLineText'],
//     3:  ['boolean', 'Checkbox'],
//     4:  ['currency', 'Currency'],
//     5:  ['date', 'Date'],
//     6:  ['field7', 'SingleLineText'],
//     7:  ['multi line', 'LongText'],
//     8:  ['multi select', 'MultiSelect'],
//     9:  ['field10', 'SingleLineText'],
//     10: ['formula', 'Decimal'],
//     11: ['percentage', 'Decimal'],
//     12: ['dateTime', 'DateTime']
// }

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`Import from excel`, () => {
        before(() => {

            cy.restoreLocalStorage();
            cy.wait(1000);

            cy.task("readSheetList", {
                file: `./scripts/cypress/fixtures/${filepath}`,
            }).then((rows) => {
                cy.log(rows);
                sheetList = rows;
            });

            cy.task("readXlsx", {
                file: `./scripts/cypress/fixtures/${filepath}`,
                sheet: "Sheet2",
            }).then((rows) => {
                cy.log(rows);
                sheetData = rows;
            });

            // loginPage.signIn(roles.owner.credentials);
            projectsPage.createProject({ dbType: "none", apiType: "REST", name: "importSample" }, {})
            cy.wait(4000);
        });

        beforeEach(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);
        });

        it("File Upload: Upload excel as template", () => {

            cy.get('.nc-add-new-table').should('exist').trigger('mouseover')
            cy.get('.nc-import-menu').should('exist').click()
            cy.getActiveMenu().find('.ant-dropdown-menu-item').contains('Microsoft Excel').click()

            // trigger import
            // cy.get(`[data-menu-id="addORImport"]`).click();
            // cy.getActivePopUp().contains("Microsoft Excel").should('exist').click();

            cy.get(".nc-input-import").should('exist').find('input').attachFile(filepath);
            cy.toastWait("Uploaded file simple.xlsx successfully");
            cy.get(".nc-btn-import").should('exist').click();

            // cy.toastWait("Uploaded file simple.xlsx successfully")
        });

        it("File Upload: Verify pre-load template page", () => {
            cy.getActiveModal()
                .find(".ant-collapse-item")
                .then((sheets) => {

                    // hardcoded. fix me.
                    let sheetList = ["Sheet2", "Sheet3", "Sheet4"];

                    for (let i = 0; i < sheets.length; i++) {
                        cy.wrap(sheets[i])
                            .find('.ant-collapse-header')
                            .contains(sheetList[i])
                            .should("exist");

                        // for each sheet, expand to verify table names & their data types
                        if(i!==0)
                            cy.wrap(sheets[i]).find(".ant-collapse-arrow").click();

                        // sheet > tables > rows > cells > inputs
                        cy.wrap(sheets[i]).find(".ant-table-tbody").then((tables) => {
                            cy.wrap(tables).find(".ant-table-row:visible")
                                .should("have.length", 3)
                                .then((rows) => {
                                    // cy.log(rows)
                                    for (let j = 0; j < rows.length; j++) {
                                        cy.wrap(rows[j]).find(".ant-table-cell")
                                          .then((cells) => {
                                            cy.wrap(cells[0]).find("input")
                                              .then((input) => {
                                                expect(input.val()).to.equal(expectedData[j][0])
                                            })
                                            cy.wrap(cells[1]).find(".ant-select-selection-item")
                                              .contains(expectedData[j][1])
                                              .should("exist")
                                        })
                                    }
                              })
                        })

                        // unwind
                        cy.wrap(sheets[i]).find(".ant-collapse-arrow").click();
                    }
                });
            cy.getActiveModal().find(".ant-btn-primary").click();
        });

        it("File Upload: Verify loaded data", () => {

            cy.openTableTab("Sheet2", 2);
            for (const [key, value] of Object.entries(expectedData)) {
                mainPage
                    .getCell(value[2], 1)
                    .contains(sheetData[0][value[0]])
                    .should("exist");
                mainPage
                    .getCell(value[2], 2)
                    .contains(sheetData[1][value[0]])
                    .should("exist");
            }
            cy.closeTableTab("Sheet2");

            cy.openTableTab("Sheet3", 2);
            for (const [key, value] of Object.entries(expectedData)) {
                mainPage
                    .getCell(value[2], 1)
                    .contains(sheetData[0][value[0]])
                    .should("exist");
                mainPage
                    .getCell(value[2], 2)
                    .contains(sheetData[1][value[0]])
                    .should("exist");
            }
            cy.closeTableTab("Sheet3");

            // // delete project once all operations are completed
            // cy.get('.nc-noco-brand-icon').click();
            //
            // cy.get(`.nc-action-btn`)
            //   .should("exist")
            //   .last()
            //   .click();
            //
            // cy.getActiveModal()
            //   .find(".ant-btn-dangerous")
            //   .should("exist")
            //   .click();
        });

        it.skip("URL: Upload excel as template", () => {
            // trigger import
            cy.get(`[data-menu-id="addORImport"]`).click();
            cy.getActivePopUp().contains("Microsoft Excel").should('exist').click();

            cy.getActiveModal().find('.ant-tabs-tab').last().click()

            cy.get("input[type=\"text\"]")
                .last()
                .click()
                .type(URL);
            cy.get(".nc-btn-primary").should('exist').click();
        });

        it.skip("URL: Verify pre-load template page", () => {
            cy.getActiveModal()
              .find(".ant-collapse-item")
              .then((sheets) => {

                  let sheetList = ["Sheet1"];

                  for (let i = 0; i < sheets.length; i++) {
                      cy.wrap(sheets[i])
                        .find('.ant-collapse-header')
                        .contains(sheetList[i])
                        .should("exist");

                      cy.wrap(sheets[i]).find(".ant-table-tbody").then((tables) => {
                          cy.wrap(tables).find(".ant-table-row:visible")
                            .then((rows) => {
                                // cy.log(rows)
                                for (let j = 0; j < 10; j++) {
                                    cy.wrap(rows[j]).find(".ant-table-cell").then((cells) => {
                                        // cy.log(cells)
                                        for (let k = 0; k < 2; k++) {
                                            cy.wrap(cells[k]).find("input").then((input) => {
                                                // cy.log(input)
                                                expect(input.val()).to.equal(UrlFileExpectedData[j][k])
                                            })
                                        }
                                    })
                                }
                            })
                      })

                      // unwind
                      cy.wrap(sheets[i]).find(".ant-collapse-arrow").click();
                  }
              });

            cy.getActiveModal().find(".ant-btn-primary").click();
        })

        it.skip("URL: Verify loaded data", () => {

            // wait for loading to be completed
            projectsPage.waitHomePageLoad();

            // open sheet & validate contents
            // sheetData contains data read from excel in format
            // 0: { float: 1.1, number: 1, text: "abc" }
            // 1: { float: 1.2, number: 0, text: "def" }

            cy.openTableTab("Sheet1", 25);
            let idx = 0;
            for (const [key, value] of Object.entries(UrlFileExpectedData)) {
                if (UrlFileExpectedData[idx][1] != "Date")
                    mainPage
                        .getCell(value[0], 1)
                        .contains(UrlFileExpectedData[idx++][2][0])
                        .should("exist");
            }
            cy.closeTableTab("Sheet1");
        });

        after(() => {
            // delete project once all operations are completed
            // mainPage.toolBarTopLeft(mainPage.HOME).click();
            // projectsPage.deleteProject("importSample");

            // cy.get('.nc-noco-brand-icon').click();
            //
            // cy.get(`.nc-action-btn`)
            //   .should("exist")
            //   .last()
            //   .click();
            //
            // cy.getActiveModal()
            //   .find(".ant-btn-dangerous")
            //   .should("exist")
            //   .click();
        });
    });
};

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
