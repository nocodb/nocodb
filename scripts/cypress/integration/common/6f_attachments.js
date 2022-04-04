import { mainPage } from "../../support/page_objects/mainPage";
import { loginPage } from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} Columns of type attachment`, () => {
        before(() => {
            loginPage.loginAndOpenProject(apiType, dbType);
            cy.openTableTab("Country", 25);
        });

        after(() => {
            mainPage.deleteColumn("testAttach");

            // clean up newly added rows into Country table operations
            // this auto verifies successfull addition of rows to table as well
            mainPage.getPagination(5).click();
            // wait for page rendering to complete
            cy.get(".nc-grid-row").should("have.length", 10);
            mainPage
                .getRow(10)
                .find(".mdi-checkbox-blank-outline")
                .click({ force: true });

            mainPage.getCell("Country", 10).rightclick();
            cy.getActiveMenu().contains("Delete Selected Row").click();

            cy.closeTableTab("Country");
        });

        it(`Add column of type attachments`, () => {
            mainPage.addColumnWithType("testAttach", "Attachment", "Country");

            for (let i = 1; i <= 2; i++) {
                let filepath = `sampleFiles/${i}.json`;
                mainPage
                    .getCell("testAttach", i)
                    .click()
                    .find('input[type="file"]')
                    .attachFile(filepath);
                mainPage
                    .getCell("testAttach", i)
                    .find(".mdi-file")
                    .should("exist");
            }
        });

        it(`Form view with Attachment field- Submit & verify`, () => {
            // create form-view
            cy.get(`.nc-create-form-view`).click();
            cy.getActiveModal().find("button:contains(Submit)").click();

            cy.toastWait("View created successfully");

            cy.get(`.nc-view-item.nc-form-view-item`)
                .contains("Country1")
                .click();

            // cy.get(".v-navigation-drawer__content > .container")
            //   .should("exist")
            //   .find(".v-list > .v-list-item")
            //   .contains("Share View")
            //   .click();
            mainPage.shareView().click();

            // copy link text, visit URL
            cy.getActiveModal()
                .find(".share-link-box")
                .contains("/nc/form/", { timeout: 10000 })
                .then(($obj) => {
                    let linkText = $obj.text().trim();
                    cy.log(linkText);
                    cy.visit(linkText, {
                        baseUrl: null,
                    });
                    cy.wait(5000);

                    // wait for share view page to load!

                    cy.get("#data-table-form-Country")
                        .should("exist")
                        .type("_abc");
                    cy.get("#data-table-form-LastUpdate").click();
                    cy.getActiveModal().find("button").contains("19").click();
                    cy.getActiveModal().find("button").contains("OK").click();

                    cy.get(".nc-field-editables")
                        .last()
                        .find('input[type="file"]')
                        .attachFile(`sampleFiles/1.json`);

                    // submit button & validate
                    cy.get(".nc-form")
                        .find("button")
                        .contains("Submit")
                        .click();
                    cy.toastWait("Saved successfully");
                });
        });

        it(`Filter column which contain only attachments, download CSV`, () => {
            // come back to main window
            loginPage.loginAndOpenProject(apiType, dbType);
            cy.openTableTab("Country", 25);

            mainPage.filterField("testAttach", "is not null", null);
            mainPage.hideField("LastUpdate");

            const verifyCsv = (retrievedRecords) => {
                let storedRecords = [
                    `Country,CityList,testAttach`,
                    `Afghanistan,Kabul,1.json(http://localhost:8080/download/p_h0wxjx5kgoq3w4/vw_skyvc7hsp9i34a/2HvU8R.json)`,
                ];

                expect(retrievedRecords[0]).to.be.equal(storedRecords[0]);
                for (let i = 1; i < storedRecords.length; i++) {
                    const columns = retrievedRecords[i].split(",");
                    expect(columns[2]).to.contain(
                        ".json(http://localhost:8080/download/"
                    );
                }

                cy.log(retrievedRecords[109]);
                cy.log(retrievedRecords[110]);
                cy.log(retrievedRecords[111]);
            };

            mainPage.downloadAndVerifyCsv(`Country_exported_1.csv`, verifyCsv);
            mainPage.unhideField("LastUpdate");
            mainPage.filterReset();
        });
    });
};

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
