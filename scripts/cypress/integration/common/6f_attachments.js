import { mainPage } from "../../support/page_objects/mainPage";
import {loginPage, projectsPage} from "../../support/page_objects/navigation";
import { isTestSuiteActive } from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
    if (!isTestSuiteActive(apiType, dbType)) return;

    describe(`${apiType.toUpperCase()} Columns of type attachment`, () => {
        before(() => {
            loginPage.loginAndOpenProject(apiType, dbType);
            cy.openTableTab("Country", 25);
            cy.wait(1000);

            cy.saveLocalStorage();
            cy.wait(1000);
        });

        beforeEach(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);
        });

        after(() => {
            cy.restoreLocalStorage();
            cy.wait(1000);

            // clean up
            mainPage.deleteColumn("testAttach");

            // clean up newly added rows into Country table operations
            // this auto verifies successfull addition of rows to table as well
            mainPage.getPagination(5).click();
            // kludge: flicker on load
            cy.wait(3000)

            // wait for page rendering to complete
            cy.get(".nc-grid-row").should("have.length", 10);
            // mainPage
            //     .getRow(10)
            //     .find(".mdi-checkbox-blank-outline")
            //     .click({ force: true });

            mainPage.getCell("Country", 10).rightclick();
            cy.getActiveMenu(".nc-dropdown-grid-context-menu").contains("Delete Row").click();

            cy.closeTableTab("Country");
        });

        it(`Add column of type attachments`, () => {
            mainPage.addColumnWithType("testAttach", "Attachment", "Country");

            for (let i = 4; i <= 6; i++) {
                let filepath = `sampleFiles/${i}.json`;
                cy.get('.nc-attachment-cell')
                  .eq(i)
                  .attachFile(filepath, { subjectType: 'drag-n-drop' });
                cy.get('.nc-attachment-cell')
                  .eq(i)
                  .find(".nc-attachment")
                  .should("exist");
            }
        });

        it(`Form view with Attachment field- Submit & verify`, () => {

            // open right navbar
            cy.get('.nc-toggle-right-navbar').should('exist').click();

            // create form-view
            cy.get(`.nc-create-form-view`).click();
            cy.getActiveModal(".nc-modal-view-create").find("button:contains(Submit)").click();

            cy.toastWait("View created successfully");

            mainPage.shareView().click();

            cy.wait(5000);

            // copy link text, visit URL
            cy.getActiveModal(".nc-modal-share-view")
                .find(".share-link-box")
                .contains("/nc/form/", { timeout: 10000 })
                .should('exist')
                .then(($obj) => {
                    let linkText = $obj.text().trim();
                    cy.log(linkText);

                    cy.visit(linkText, {
                        baseUrl: null,
                    });
                    cy.wait(5000);

                    // wait for share view page to load!
                    cy.get(".nc-form").should("exist");

                    // fill form
                    // 0: Country
                    // 1: LastUpdate
                    cy.get(".nc-input").eq(0).type("_abc");
                    cy.get(".nc-input").eq(1).click();
                    cy.get('.ant-picker-dropdown').find(".ant-picker-now-btn").click();
                    cy.get('.ant-picker-dropdown').find("button.ant-btn-primary").click();


                    cy.get('.nc-attachment-cell')
                      .attachFile(`sampleFiles/1.json`, { subjectType: 'drag-n-drop' });

                    cy.get(".nc-form").find("button").contains("Submit").click();

                    cy.get(".ant-alert-message")
                      .contains("Successfully submitted form data")
                      .should("exist");

                    cy.toastWait("Saved successfully");
                });
        });

        it(`Filter column which contain only attachments, download CSV`, () => {
            // come back to main window
            // loginPage.loginAndOpenProject(apiType, dbType);
            cy.visit('/')
            cy.wait(5000)

            projectsPage.openConfiguredProject(apiType, dbType);
            cy.openTableTab("Country", 25);
            cy.wait(1000);

            mainPage.filterField("testAttach", "is not null", null);
            mainPage.hideField("LastUpdate");

            const verifyCsv = (retrievedRecords) => {
                let storedRecords = [
                    `Country,City List,testAttach`,
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
