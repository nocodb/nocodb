// Cypress test suite: Project creation using EXCEL
//

import { projectsPage } from "../../support/page_objects/navigation";
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
    0: ["number", "Number"],
    1: ["float", "Decimal"],
    2: ["text", "SingleLineText"],
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

            // cy.task('readXlsx', { file: `./scripts/cypress/fixtures/${UrlFilePath}`, sheet: "Sheet1" })
            //     .then((rows) => {
            //         cy.log(rows)
            //         UrlSheetData = rows
            // })
        });

        it("File Upload: Upload excel as template", () => {
            mainPage.toolBarTopLeft(mainPage.HOME).click();

            // click on "New Project"
            cy.get(":nth-child(5) > .v-btn", { timeout: 20000 }).click();

            // Subsequent form, select (+ Create) option
            cy.get(".nc-create-project-from-excel", { timeout: 20000 }).click({
                force: true,
            });

            cy.snipActiveModal("Modal_CreateFromExcel");

            cy.get(".nc-excel-import-input").attachFile(filepath);
            cy.get(".nc-btn-use-template", { timeout: 120000 }).should("exist");
        });

        it("File Upload: Verify pre-load template page", () => {
            cy.snip("ExcelImport");
            cy.getActiveContentModal()
                .find(".v-expansion-panel")
                .then((sheets) => {
                    for (let i = 0; i < sheets.length; i++) {
                        // verify if all sheet names are correct
                        // cy.wrap(sheets[i]).find('.title').then((blk) => {
                        //     cy.log(blk.text().trim())
                        //     expect(blk.text().trim()).to.equal(sheetList[i])
                        // })

                        cy.wrap(sheets[i])
                            .contains(sheetList[i])
                            .should("exist");

                        // for each sheet, expand to verify table names & their data types
                        cy.wrap(sheets[i]).find(".mdi-chevron-down").click();

                        // wait for 4 DOM rows to become visible, corresponding to 4 column names in excel
                        // change to avoid static wait
                        cy.get(".v-data-table")
                            .find("tr:visible")
                            .should("have.length", 4);

                        cy.get(".v-data-table")
                            .find("tr:visible")
                            .then((row) => {
                                for (let j = 1; j < row.length; j++) {
                                    // column name to match input in excel
                                    cy.wrap(row[j])
                                        .find('[placeholder="Column Name"]')
                                        .then((obj) => {
                                            cy.log(obj[0].value);
                                            expect(obj[0].value).to.equal(
                                                expectedData[j - 1][0]
                                            );
                                        });

                                    // datatype to match expected output
                                    cy.wrap(row[j])
                                        .find("span.caption")
                                        .then((obj) => {
                                            cy.log(obj[0].innerText);
                                            expect(obj[0].innerText).to.equal(
                                                expectedData[j - 1][1]
                                            );
                                        });
                                }
                            });

                        // unwind
                        cy.wrap(sheets[i]).find(".mdi-chevron-down").click();
                    }
                });
        });

        it("File Upload: Verify loaded data", () => {
            // create rest/ gql project
            cy.get(".nc-btn-use-template", { timeout: 120000 }).click();
            // if (type == 'rest') {
            //     cy.getActiveMenu().find('[role="menuitem"]').contains('REST').click()
            // } else {
            //     cy.getActiveMenu().find('[role="menuitem"]').contains('GQL').click()
            // }

            // wait for loading to be completed
            projectsPage.waitHomePageLoad();

            // open sheet & validate contents
            // sheetData contains data read from excel in format
            // 0: { float: 1.1, number: 1, text: "abc" }
            // 1: { float: 1.2, number: 0, text: "def" }

            cy.openTableTab("Sheet2", 2);
            for (const [key, value] of Object.entries(expectedData)) {
                mainPage
                    .getCell(value[0], 1)
                    .contains(sheetData[0][value[0]])
                    .should("exist");
                mainPage
                    .getCell(value[0], 2)
                    .contains(sheetData[1][value[0]])
                    .should("exist");
            }
            cy.closeTableTab("Sheet2");

            cy.openTableTab("Sheet3", 2);
            for (const [key, value] of Object.entries(expectedData)) {
                mainPage
                    .getCell(value[0], 1)
                    .contains(sheetData[0][value[0]])
                    .should("exist");
                mainPage
                    .getCell(value[0], 2)
                    .contains(sheetData[1][value[0]])
                    .should("exist");
            }
            cy.closeTableTab("Sheet3");

            // delete project once all operations are completed
            mainPage.toolBarTopLeft(mainPage.HOME).click();
            cy.get(`.nc-${apiType}-project-row .mdi-delete-circle-outline`, {
                timeout: 10000,
            })
                .should("exist")
                .last()
                .invoke("show")
                .click();
            cy.contains("Submit").closest("button").click();
        });

        it("URL: Upload excel as template", () => {
            // click on "New Project"
            cy.get(":nth-child(5) > .v-btn", { timeout: 20000 }).click();

            // Subsequent form, select (+ Create) option
            cy.get(".nc-create-project-from-excel", { timeout: 20000 }).click({
                force: true,
            });

            cy.snipActiveModal("Modal_ImportExcelURL");
            cy.getActiveModal().find(".caption").contains("URL").click();
            cy.get(".nc-excel-import-tab-item")
                .find('input[type="url"]')
                .click()
                .type(URL);
            cy.get(".nc-excel-import-tab-item")
                .find("button")
                .contains("Load")
                .click();

            cy.get(".nc-btn-use-template", { timeout: 120000 }).should("exist");
        });

        it("URL: Verify pre-load template page", () => {
            cy.getActiveContentModal()
                .find(".v-expansion-panel")
                .then((sheets) => {
                    for (let i = 0; i < sheets.length; i++) {
                        // verify if all sheet names are correct
                        // cy.wrap(sheets[i]).find('.title').then((blk) => {
                        //     cy.log(blk.text().trim())
                        //     expect(blk.text().trim()).to.equal('Sheet1')
                        // })

                        cy.wrap(sheets[i]).contains("Sheet1").should("exist");

                        // for each sheet, expand to verify table names & their data types
                        cy.wrap(sheets[i]).find(".mdi-chevron-down").click();
                        cy.wait(3000).then(() => {
                            cy.get(".v-data-table")
                                .find("tr:visible")
                                .then((row) => {
                                    // verification restricting to 10, as others need to be scrolled back into view
                                    for (
                                        let j = 1;
                                        j <= 10 /*row.length*/;
                                        j++
                                    ) {
                                        // column name to match input in excel
                                        cy.wrap(row[j])
                                            .find('[placeholder="Column Name"]')
                                            .then((obj) => {
                                                cy.log(obj[0].value);
                                                expect(obj[0].value).to.equal(
                                                    UrlFileExpectedData[
                                                        j - 1
                                                    ][0]
                                                );
                                            });

                                        // datatype to match expected output
                                        cy.wrap(row[j])
                                            .find("span.caption")
                                            .then((obj) => {
                                                cy.log(obj[0].innerText);
                                                expect(
                                                    obj[0].innerText
                                                ).to.equal(
                                                    UrlFileExpectedData[
                                                        j - 1
                                                    ][1]
                                                );
                                            });
                                    }
                                });
                        });

                        // unwind
                        cy.wrap(sheets[i]).find(".mdi-chevron-down").click();
                    }
                });
        });

        it("URL: Verify loaded data", () => {
            // create rest/ gql project
            cy.get(".nc-btn-use-template", { timeout: 120000 }).click();

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
            mainPage.toolBarTopLeft(mainPage.HOME).click();
            cy.get(`.nc-${apiType}-project-row .mdi-delete-circle-outline`, {
                timeout: 10000,
            })
                .should("exist")
                .last()
                .invoke("show")
                .click();
            cy.contains("Submit").closest("button").click();
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
